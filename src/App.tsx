import React from 'react'
import { Page, PageSidebar, PageSection, Brand, Masthead, MastheadMain, MastheadBrand, MastheadContent, Toolbar, ToolbarContent, ToolbarItem, Button } from '@patternfly/react-core'
import { Routes, Route, Link } from 'react-router-dom'
import { YamlSidebar } from './modules/yaml/YamlSidebar'
import { ConfigPanel } from './modules/config/ConfigPanel'
import { Builder } from './modules/builder/Builder'

export default function App() {
  const [isYamlOpen, setYamlOpen] = React.useState(false)

  React.useEffect(() => {
    const handler = () => setYamlOpen(true)
    window.addEventListener('open-yaml', handler)
    return () => window.removeEventListener('open-yaml', handler)
  }, [])

  const header = (
    <Masthead>
      <MastheadMain>
        <MastheadBrand>
          <Brand src="" alt="OCP RBAC Builder"/>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar isFullHeight isStatic>
          <ToolbarContent>
            <ToolbarItem>
              <Button variant="secondary" onClick={() => setYamlOpen(v => !v)}>
                Toggle YAML
              </Button>
            </ToolbarItem>
            <ToolbarItem>
              <Link to="/">Builder</Link>
            </ToolbarItem>
            <ToolbarItem>
              <Link to="/config">Config</Link>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  )

  return (
    <YamlSidebar isOpen={isYamlOpen} onClose={() => setYamlOpen(false)}>
      <Page key={header.key} sidebar={<PageSidebar isSidebarOpen={false} />}> 
        <PageSection isFilled>
          <Routes>
            <Route path="/" element={<Builder />} />
            <Route path="/config" element={<ConfigPanel />} />
          </Routes>
        </PageSection>
        {!isYamlOpen && (
          <div style={{ position: 'fixed', right: 16, top: 16, zIndex: 1000 }}>
            <Button variant="secondary" onClick={() => setYamlOpen(true)}>Show YAML</Button>
          </div>
        )}
      </Page>
    </YamlSidebar>
  )
}
