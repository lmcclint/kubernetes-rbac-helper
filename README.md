# Kubernetes RBAC Helper

A local-first web UI to compose Kubernetes/OpenShift RBAC YAML from selected resources, verbs, scope, and subjects. Intended to stay cluster-agnostic and optionally evolve into an OpenShift Console dynamic plugin.

Status: pre-alpha (vertical slice)

## Quick start (containerized dev)
Run the dev server in a disposable Node container, no global installs required:

```bash
podman run --rm -it \
  -v $(pwd):/workspace \
  -w /workspace \
  -p 5173:5173 \
  docker.io/library/node:20-bookworm bash -lc "npm install && npm run dev -- --host 0.0.0.0"
```

In another terminal, run a local Kubernetes API proxy (avoids CORS/TLS issues):

```bash
kubectl proxy --port=8001 --address=0.0.0.0 --accept-hosts='^*'
```

Open http://localhost:5173 and set Config → API endpoint to `http://localhost:8001`.

## Scripts
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

## Notes
- No tokens or preferences are persisted; theme follows OS by default.
- YAML is live-editable in the sidebar, and can be copied or downloaded as a single multi-doc file.

## Roadmap (short)
- CRD discovery + resource picker with namespace scoping
- Role/ClusterRole and Binding YAML generation (js-yaml)
- Namespace pick-list with API-backed suggestions
- Optional tests and CI later

## Security
This UI never applies changes; it only generates YAML. Prefer `kubectl proxy` or a local dev proxy to avoid exposing credentials in the browser. Tokens are not stored.
