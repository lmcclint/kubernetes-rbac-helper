import React from 'react'
import { PageSection, Title, Grid, GridItem, Form, FormGroup, Checkbox, TextInput, Button, Divider, Spinner } from '@patternfly/react-core'
import { useAppConfig } from '../../state/config'
import { useYamlStore } from '../yaml/yamlStore'
import { fetchCRDs, fetchNamespaces, fetchApiGroups, fetchApiResourceList, fetchCoreV1Resources, fetchOpenShiftUsers, fetchOpenShiftGroups, fetchServiceAccounts } from '../../api/k8s'
import yaml from 'js-yaml'

const ALL_VERBS = ['get','list','watch','create','update','patch','delete','deletecollection']

// Minimal CRD/built-in resource view
type ResourceEntry = { id: string; group: string; version: string; resource: string; namespaced: boolean; source: 'builtin' | 'crd' }

export function Builder() {
  const { baseUrl } = useAppConfig()
  const { setYaml } = useYamlStore()

  const [isClusterScope, setIsClusterScope] = React.useState(false)
  const [selectedVerbs, setSelectedVerbs] = React.useState<string[]>(['get','list','watch'])
  const [subjectKind, setSubjectKind] = React.useState<'ServiceAccount' | 'User' | 'Group'>('ServiceAccount')
  const [subject, setSubject] = React.useState('')
  const [subjectNamespace, setSubjectNamespace] = React.useState('default')
  const [namespaces, setNamespaces] = React.useState<string[]>([])
  const [newNamespace, setNewNamespace] = React.useState('')

  const [allNamespaces, setAllNamespaces] = React.useState<string[]>([])
  const [nsError, setNsError] = React.useState<string | null>(null)

  const [allUsers, setAllUsers] = React.useState<string[]>([])
  const [allGroups, setAllGroups] = React.useState<string[]>([])
  const [allServiceAccounts, setAllServiceAccounts] = React.useState<string[]>([])
  const [ugError, setUgError] = React.useState<string | null>(null)
  const [saError, setSaError] = React.useState<string | null>(null)

  const [resources, setResources] = React.useState<ResourceEntry[]>([])
  const [resError, setResError] = React.useState<string | null>(null)
  const [resFilter, setResFilter] = React.useState('')
  const [resSourceFilter, setResSourceFilter] = React.useState<'all' | 'builtin' | 'crd'>('all')
  const [selectedResourceIds, setSelectedResourceIds] = React.useState<string[]>([])

  const [loadingResources, setLoadingResources] = React.useState(false)
  const [loadingNamespaces, setLoadingNamespaces] = React.useState(false)
  const isLoading = !!baseUrl && (loadingResources || loadingNamespaces)

  React.useEffect(() => {
    if (!baseUrl) return
    let cancelled = false
    ;(async () => {
      try {
        setResError(null)
        setLoadingResources(true)
        const entriesMap = new Map<string, ResourceEntry>()

        // 1) CRD-derived resources (from the CRD spec)
        try {
          const data = await fetchCRDs(baseUrl)
          const items: any[] = Array.isArray(data.items) ? data.items : []
          for (const crd of items) {
            const group = crd?.spec?.group
            const plural = crd?.spec?.names?.plural
            const scope = crd?.spec?.scope // 'Namespaced' | 'Cluster'
            const versions: any[] = Array.isArray(crd?.spec?.versions) ? crd.spec.versions : []
            for (const v of versions) {
              const version = v?.name
              if (group && plural && version) {
                const id = `${group}/${version}/${plural}`
                entriesMap.set(id, { id, group, version, resource: plural, namespaced: scope === 'Namespaced', source: 'crd' })
              }
            }
          }
        } catch (e) {
          // Non-fatal; still proceed with API discovery
        }

        // 2) Core v1 resources
        try {
          const core = await fetchCoreV1Resources(baseUrl)
          const gv = core?.groupVersion || 'v1'
          const version = 'v1'
          const group = ''
          const resArr: any[] = Array.isArray(core?.resources) ? core.resources : []
          for (const r of resArr) {
            const name = r?.name
            if (!name || String(name).includes('/')) continue // skip subresources
            const id = `${group}/${version}/${name}`
            entriesMap.set(id, { id, group, version, resource: name, namespaced: !!r?.namespaced, source: 'builtin' })
          }
        } catch (e) {
          // ignore; continue
        }

        // 3) Group preferred versions
        try {
          const groups = await fetchApiGroups(baseUrl)
          const preferredGVs: string[] = []
          for (const g of groups) {
            const gv = g?.preferredVersion?.groupVersion
            if (gv && typeof gv === 'string') preferredGVs.push(gv)
          }
          // Fetch each preferred groupVersion
          for (const gv of preferredGVs) {
            try {
              const list = await fetchApiResourceList(baseUrl, gv)
              const gvStr: string = list?.groupVersion || gv
              const [group, version] = gvStr.includes('/') ? gvStr.split('/') : ['', gvStr]
              const resArr: any[] = Array.isArray(list?.resources) ? list.resources : []
              for (const r of resArr) {
                const name = r?.name
                if (!name || String(name).includes('/')) continue
                const id = `${group}/${version}/${name}`
                entriesMap.set(id, { id, group, version, resource: name, namespaced: !!r?.namespaced, source: 'builtin' })
              }
            } catch {
              // ignore single groupVersion failure
            }
          }
        } catch (e) {
          // ignore; some clusters restrict /apis
        }

        const entries = Array.from(entriesMap.values()).sort((a,b) => a.resource.localeCompare(b.resource))
        if (!cancelled) setResources(entries)
      } catch (e: any) {
        if (!cancelled) setResError(String(e?.message || e))
      } finally {
        if (!cancelled) setLoadingResources(false)
      }
    })()
    return () => { cancelled = true }
  }, [baseUrl])

  // Fetch OpenShift Users/Groups when selected
  const [loadingUG, setLoadingUG] = React.useState(false)
  React.useEffect(() => {
    if (!baseUrl) return
    if (subjectKind !== 'User' && subjectKind !== 'Group') {
      setAllUsers([]); setAllGroups([]); setUgError(null); setLoadingUG(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setUgError(null)
        setLoadingUG(true)
        if (subjectKind === 'User') {
          const users = await fetchOpenShiftUsers(baseUrl)
          if (!cancelled) setAllUsers(users)
        } else if (subjectKind === 'Group') {
          const groups = await fetchOpenShiftGroups(baseUrl)
          if (!cancelled) setAllGroups(groups)
        }
      } catch (e: any) {
        if (!cancelled) setUgError(String(e?.message || e))
      } finally {
        if (!cancelled) setLoadingUG(false)
      }
    })()
    return () => { cancelled = true }
  }, [baseUrl, subjectKind])

  // Load ServiceAccounts for selected namespace when subjectKind is ServiceAccount
  const [loadingSA, setLoadingSA] = React.useState(false)
  React.useEffect(() => {
    if (!baseUrl) return
    if (subjectKind !== 'ServiceAccount') {
      setAllServiceAccounts([]); setSaError(null); setLoadingSA(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setSaError(null)
        setLoadingSA(true)
        const sas = await fetchServiceAccounts(baseUrl, subjectNamespace || 'default')
        if (!cancelled) setAllServiceAccounts(sas)
      } catch (e: any) {
        if (!cancelled) setSaError(String(e?.message || e))
      } finally {
        if (!cancelled) setLoadingSA(false)
      }
    })()
    return () => { cancelled = true }
  }, [baseUrl, subjectKind, subjectNamespace])

  React.useEffect(() => {
    if (!baseUrl) return
    let cancelled = false
    ;(async () => {
      try {
        setNsError(null)
        setLoadingNamespaces(true)
        const ns = await fetchNamespaces(baseUrl)
        if (!cancelled) setAllNamespaces(ns.sort())
      } catch (e: any) {
        if (!cancelled) setNsError(String(e?.message || e))
      } finally {
        if (!cancelled) setLoadingNamespaces(false)
      }
    })()
    return () => { cancelled = true }
  }, [baseUrl])

  const toggleVerb = (verb: string) => {
    setSelectedVerbs(v => v.includes(verb) ? v.filter(x => x !== verb) : [...v, verb])
  }

  const toggleResource = (id: string) => {
    setSelectedResourceIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  }

  const filteredResources = resources.filter(r => {
    const passesSource = resSourceFilter === 'all' || r.source === resSourceFilter
    const text = `${r.group || 'core'}/${r.version}/${r.resource}`.toLowerCase()
    const passesText = !resFilter || text.includes(resFilter.toLowerCase())
    return passesSource && passesText
  })

  const clearSelection = () => {
    setSelectedResourceIds([])
    setSelectedVerbs(['get','list','watch'])
  }

  const onGenerate = () => {
    const roleKind = isClusterScope ? 'ClusterRole' : 'Role'
    const bindingKind = isClusterScope ? 'ClusterRoleBinding' : 'RoleBinding'

    // Build rules grouped by apiGroup
    const selected = resources.filter(r => selectedResourceIds.includes(r.id))
    const byGroup = new Map<string, string[]>()
    for (const r of selected) {
      const list = byGroup.get(r.group) || []
      if (!list.includes(r.resource)) list.push(r.resource)
      byGroup.set(r.group, list)
    }
    const rules = Array.from(byGroup.entries()).map(([apiGroup, resList]) => ({
      apiGroups: [apiGroup],
      resources: resList,
      verbs: selectedVerbs
    }))
    if (rules.length === 0) {
      // fallback: avoid empty rules
      rules.push({ apiGroups: ['*'], resources: ['*'], verbs: selectedVerbs })
    }

    const docs: any[] = []

    const baseName = slug(`${subject}-${isClusterScope ? 'cluster' : 'ns'}`)

    if (isClusterScope) {
      const roleName = baseName || 'generated-clusterrole'
      const role = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRole',
        metadata: { name: roleName },
        rules
      }
      const subjectBlock: any = {
        kind: subjectKind,
        name: subject,
        ...(subjectKind === 'ServiceAccount' ? { namespace: subjectNamespace } : {})
      }
      const binding = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRoleBinding',
        metadata: { name: `${roleName}-binding` },
        subjects: [subjectBlock],
        roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: roleName }
      }
      docs.push(role, binding)
    } else {
      const nsList = namespaces.length ? namespaces : ['default']
      for (const ns of nsList) {
        const roleName = baseName || `generated-role-${ns}`
        const role = {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'Role',
          metadata: { name: roleName, namespace: ns },
          rules
        }
        const subjectBlock: any = {
          kind: subjectKind,
          name: subject,
          ...(subjectKind === 'ServiceAccount' ? { namespace: subjectNamespace } : {})
        }
        const binding = {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'RoleBinding',
          metadata: { name: `${roleName}-binding`, namespace: ns },
          subjects: [subjectBlock],
          roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: roleName }
        }
        docs.push(role, binding)
      }
    }

    const docText = docs.map(d => `---\n${yaml.dump(d)}`).join('\n')
    setYaml(docText)
    // Prompt opening the YAML drawer
    try { window.dispatchEvent(new Event('open-yaml')) } catch {}
  }

  const nsSuggestions = (newNamespace ? allNamespaces.filter(n => n.toLowerCase().includes(newNamespace.toLowerCase())) : allNamespaces).slice(0, 10)
  const subjectSuggestions = React.useMemo(() => {
    const haystack = subjectKind === 'User' ? allUsers : subjectKind === 'Group' ? allGroups : subjectKind === 'ServiceAccount' ? allServiceAccounts : []
    if (!subject) return haystack.slice(0, 10)
    const s = subject.toLowerCase()
    return haystack.filter(x => x.toLowerCase().includes(s)).slice(0, 10)
  }, [subjectKind, allUsers, allGroups, allServiceAccounts, subject])

  const quickUserPicks: string[] = React.useMemo(() => [
    'system:admin',
    'kube:admin'
  ], [])

  const quickGroupPicks: string[] = React.useMemo(() => {
    const base = ['system:authenticated', 'system:unauthenticated', 'system:masters', 'system:serviceaccounts']
    const nsScoped = namespaces.slice(0, 10).map(ns => `system:serviceaccounts:${ns}`)
    return [...base, ...nsScoped]
  }, [namespaces])

  return (
    <PageSection style={{ position: 'relative' }}>
      <Title headingLevel="h1">RBAC Builder</Title>
      <div style={{ marginTop: 8, color: '#6a6e73' }}>
        API endpoint: {baseUrl ? <code>{baseUrl}</code> : <em>not configured</em>}
        {' '}<Button variant="link" onClick={() => (window.location.href = '/config')}>Open Config</Button>
        {!baseUrl && (
          <>
            {' '}or{' '}
            <Button variant="secondary" onClick={() => (useAppConfig.getState().setBaseUrl('http://localhost:8001'))}>Use http://localhost:8001</Button>
          </>
        )}
      </div>
      <Divider style={{ margin: '16px 0' }} />

      {isLoading && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Spinner size="xl" />
            <div style={{ color: '#151515' }}>Loading cluster objects...</div>
          </div>
        </div>
      )}

      <Grid hasGutter aria-busy={isLoading}>
        <GridItem span={12} lg={6}>
          <Form>
            <FormGroup label="Scope" fieldId="scope">
              <Checkbox id="scope-cluster" label="Cluster-scoped" isChecked={isClusterScope} onChange={(_, v) => setIsClusterScope(v)} isDisabled={isLoading} />
            </FormGroup>

            {!isClusterScope && (
              <FormGroup label="Namespaces" fieldId="namespaces">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <TextInput id="ns-input" value={newNamespace} onChange={(_, v) => setNewNamespace(v)} placeholder="Add namespace" isDisabled={isLoading} />
                  <Button
                    variant="secondary"
                    isDisabled={isLoading}
                    onClick={() => {
                      const v = newNamespace.trim()
                      if (v && !namespaces.includes(v)) {
                        setNamespaces([...namespaces, v])
                        setNewNamespace('')
                      }
                    }}
                  >Add</Button>
                </div>
                {nsError && <div style={{ color: 'var(--pf-t--global--danger-color--100)' }}>{nsError}</div>}
                {allNamespaces.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <small>Suggestions:</small>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {nsSuggestions.map(ns => (
                        <Button key={ns} variant="tertiary" size="sm" onClick={() => !namespaces.includes(ns) && setNamespaces([...namespaces, ns])}>{ns}</Button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {namespaces.map(ns => (
                    <Button key={ns} variant="secondary" size="sm" onClick={() => setNamespaces(namespaces.filter(n => n !== ns))} isDisabled={isLoading}>
                      {ns} ×
                    </Button>
                  ))}
                </div>
              </FormGroup>
            )}

            <FormGroup label="Verbs" fieldId="verbs">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ALL_VERBS.map(v => (
                  <Checkbox key={v} id={`verb-${v}`} label={v} isChecked={selectedVerbs.includes(v)} onChange={() => toggleVerb(v)} isDisabled={isLoading} />
                ))}
              </div>
            </FormGroup>

            <FormGroup label="Subject kind" fieldId="subject-kind">
              <select
                id="subject-kind"
                value={subjectKind}
                onChange={(e) => { setSubjectKind(e.target.value as any); setSubject('') }}
                style={{ padding: 8 }}
                disabled={isLoading}
              >
                {['ServiceAccount','User','Group'].map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </FormGroup>

            {subjectKind === 'ServiceAccount' && (
              <FormGroup label="SA namespace" fieldId="sa-ns">
                <TextInput id="sa-ns" value={subjectNamespace} onChange={(_, v) => setSubjectNamespace(v)} isDisabled={isLoading} />
              </FormGroup>
            )}

            <FormGroup label="Subject name" fieldId="subject-name">
              <TextInput id="subject-name" value={subject} onChange={(_, v) => setSubject(v)} placeholder={subjectKind === 'ServiceAccount' ? 'service-account-name' : subjectKind === 'User' ? 'user name' : 'group name'} isDisabled={isLoading} />
              <div style={{ marginTop: 6 }}>
                {(subjectKind === 'User' || subjectKind === 'Group') ? (
                  ugError ? (
                    <div style={{ color: 'var(--pf-t--global--danger-color--100)' }}>{ugError}</div>
                  ) : (
                    <>
                      {subjectSuggestions.length > 0 ? (
                        <div>
                          <small>Suggestions:</small>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            {loadingUG ? (
                              <small style={{ color: '#6a6e73' }}>Loading suggestions…</small>
                            ) : (
                              subjectSuggestions.map(s => (
                                <Button key={s} variant="tertiary" size="sm" onClick={() => setSubject(s)} isDisabled={isLoading}>{s}</Button>
                              ))
                            )}
                          </div>
                        </div>
                      ) : (
                        <small style={{ color: '#6a6e73' }}>No suggestions. You can type any {subjectKind.toLowerCase()}.</small>
                      )}
                      <div style={{ marginTop: 8 }}>
                        <small>Quick picks:</small>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          {(subjectKind === 'User' ? quickUserPicks : quickGroupPicks).map(q => (
                            <Button key={q} variant="secondary" size="sm" onClick={() => setSubject(q)} isDisabled={isLoading}>{q}</Button>
                          ))}
                        </div>
                        {subjectKind === 'Group' && namespaces.length > 0 && (
                          <div style={{ marginTop: 4, color: '#6a6e73' }}>
                            <small>Includes service account groups for selected namespaces.</small>
                          </div>
                        )}
                      </div>
                    </>
                  )
                ) : (
                  saError ? (
                    <div style={{ color: 'var(--pf-t--global--danger-color--100)' }}>{saError}</div>
                  ) : (
                    <div>
                      <small>ServiceAccounts in namespace "{subjectNamespace}":</small>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {loadingSA ? (
                          <small style={{ color: '#6a6e73' }}>Loading suggestions…</small>
                        ) : (
                          subjectSuggestions.map(s => (
                            <Button key={s} variant="tertiary" size="sm" onClick={() => setSubject(s)} isDisabled={isLoading}>{s}</Button>
                          ))
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </FormGroup>

            <Button variant="primary" onClick={onGenerate} isDisabled={!subject || isLoading}>Generate / Refresh YAML</Button>
          </Form>
        </GridItem>
        <GridItem span={12} lg={6}>
          <Title headingLevel="h2">Resources</Title>
          {resError && <div style={{ color: 'var(--pf-t--global--danger-color--100)' }}>{resError}</div>}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant={resSourceFilter==='all' ? 'primary' : 'secondary'} size="sm" onClick={() => setResSourceFilter('all')} isDisabled={isLoading}>All</Button>
              <Button variant={resSourceFilter==='builtin' ? 'primary' : 'secondary'} size="sm" onClick={() => setResSourceFilter('builtin')} isDisabled={isLoading}>Built-ins</Button>
              <Button variant={resSourceFilter==='crd' ? 'primary' : 'secondary'} size="sm" onClick={() => setResSourceFilter('crd')} isDisabled={isLoading}>CRDs</Button>
            </div>
            <TextInput id="res-filter" value={resFilter} onChange={(_, v) => setResFilter(v)} placeholder="Filter by group/version/resource" isDisabled={isLoading} />
            <span style={{ flex: '0 0 8px' }} />
            <Button variant="secondary" size="sm" onClick={clearSelection} isDisabled={isLoading}>Clear</Button>
          </div>
          <div style={{ display: 'grid', gap: 6, maxHeight: 400, overflow: 'auto', border: '1px solid var(--pf-t--global--border--color--default)', padding: 8 }}>
            {filteredResources.map(r => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={selectedResourceIds.includes(r.id)} onChange={() => toggleResource(r.id)} disabled={isLoading} />
                <span>{r.resource}</span>
                <span style={{ color: '#6a6e73' }}>({(r.group || 'core')}/{r.version}{r.namespaced ? ', namespaced' : ', cluster'})</span>
              </label>
            ))}
            {filteredResources.length === 0 && (
              <div style={{ color: '#6a6e73' }}>No CRDs found or filter has no matches.</div>
            )}
          </div>
        </GridItem>
      </Grid>
    </PageSection>
  )
}

function slug(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
