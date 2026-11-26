# Kito preview operator

These sources own the private Remote Testing workflow service and workspace-side HTTPS bridge. Deploy them from the same revision as the companion. The controller continues to authorize workspace reads and the two declared `preview-admin` service operations. It receives no new general execution route. The workflow key, Google credentials, Kubernetes tokens, deployment addresses, manifests containing operator values, invitation links and built bundles stay outside Git.

## Routing and authentication

`POST /v1/kito-workflow/previews/<workspace-id>` authenticates the scoped workflow key with the controller and checks workspace ownership, template, purpose, state and deadline. It prepares the workspace's bridge with an immutable origin and expiry. It creates a Service, HTTPRoute, health policy, backend policy and ingress policy named for that workspace. The route sends dashboard traffic to port 8080 and signed sandbox assets to port 8081. No shared preview selector is changed. Each route selects only its workspace Pod.

Each origin is `https://<workspace-id>.<preview-domain>`. Supply DNS that resolves those names to the existing Gateway. The workflow creates a Google-managed certificate and map entry for each hostname using load balancer authorization. No wildcard certificate or fixed hostname pool is required. First use waits for certificate issuance and verifies the workspace identity through HTTPS before minting an invitation. The deployment must have sufficient Gateway, backend, certificate and compute quota; quota errors remain visible. The companion waits up to 30 minutes and can be canceled. For large deployments, provision an operator-controlled DNS zone and certificate strategy suitable for their provider quotas.

The invitation is a one-use fragment exchanged by POST, never a query parameter. The bridge issues a Secure, HttpOnly, host-only cookie and a separate dashboard login. Origin checks reject another preview's writes and WebSockets. Each workspace owns its own Prompt Studio home, database, tokens and browser storage. Sandbox assets retain Prompt Studio's signed URL authorization and null-origin restrictions.

A preview's first preparation fixes its expiry, no later than the workspace deadline or 90 minutes from preparation. Reopening mints a new invitation and preserves the deadline and sessions. The gate closes active HTTP/WebSocket connections at expiry. Stopping the workspace ends its processes and sessions. Pod owner references remove all five Kubernetes resources. Every 30 seconds, including after restart, the workflow reconciles its labeled certificates for its deployment (namespace, certificate map and Gateway) against expiry and Pod existence, removes stale ingress, then removes the map entry and certificate. A failed removal retains the certificate record for retry; a failure for one preview does not prevent cleanup of others. It never sweeps the old shared-host resources or unlabeled certificates.

## Upgrade an equipped deployment

Retain an operator-only copy of the current ConfigMap, Deployment, IAM policy and approved preview base before upgrading. Keep all running previews and the old shared Services, HTTPRoutes, policies and certificate intact. Old template workspaces can finish using their existing routes. They cannot switch origins in place; use the updated template for new isolated previews.

1. Provide Workload Identity for the workflow Kubernetes service account. Its Google service account needs the existing bucket/signing permissions and Certificate Manager certificate/map-entry create, read, list, use and delete permissions in the operator project (`roles/certificatemanager.editor` is the standard operator role). Keep this identity out of workspace Pods. Preserve the scoped workflow key Secret and controller service relay permissions.
2. Create a private deployment JSON file with the following fields. All are required; no deployment addresses or credentials are built into the source.

| Field | Value |
| --- | --- |
| `project`, `namespace` | Google project and existing controller namespace |
| `domain` | Preview DNS suffix resolving to the Gateway |
| `certificateMap`, `gateway`, `securityPolicy` | Existing certificate map, HTTPS Gateway and Cloud Armor policy names |
| `image` | Approved Bun runtime image pinned by digest |
| `serviceAccount` | Google Workload Identity service account email |
| `controller` | Internal controller HTTP origin |
| `storageBucket`, `signerAccount` | Existing remote-test bucket and signing service account |
| `keySecret` | Existing Secret containing the workflow key's `hash` |

3. Build `server.ts` with Bun, install its output as `server.js` in the existing `kito-workflow-code` ConfigMap, then render and apply the deployment. Run commands from this directory; use your operator Kubernetes configuration and private paths.

```sh
bun build server.ts --target=bun --outfile /private/build/server.js
kubectl -n <namespace> create configmap kito-workflow-code \
  --from-file=server.js=/private/build/server.js --dry-run=client -o yaml > /private/build/code.yaml
kubectl apply -f /private/build/code.yaml
bun deployment.ts /private/deployment.json > /private/build/deployment.json
kubectl apply -f /private/build/deployment.json
kubectl -n <namespace> rollout restart deployment/kito-workflow
kubectl -n <namespace> rollout status deployment/kito-workflow
```

The render updates the equipped workflow's service account, namespace Role/RoleBinding, runtime and public HTTPS/DNS egress. Preserve its existing Service, controller ingress policy, metadata/Kubernetes egress rules, HealthCheckPolicy, Cloud Armor policy and workflow HTTPRoute. The workflow needs controller access, Kubernetes API access, Workload Identity metadata, cluster DNS and Google public HTTPS. Workspace ingress admits only Google's load balancer/health-check ranges on the two preview ports; controller administrative operations continue over the existing relay channel.

4. Bundle the workspace-side services into the approved base, then replace only that base in the companion's private extension storage. Keep the base name `prompt-studio-preview`; branch publication hashes its full specification and selects the approved `prompt-studio-preview-branch` family. Never edit an already published immutable template or invent a new family per preview.

```sh
bun prepare-template.ts /private/approved-preview.json /private/isolated-preview.json
```

5. Install the matching Remote Testing and Cloud Workspaces sources through the supported extension installation workflow. Preserve device connection bindings and the project's approved test/preview manifests. Enable **Kito API key** in Remote Testing settings.
6. Run and open two new previews through `pst pocketcoder.remote-testing preview run/open`. Verify distinct origins, valid TLS, invitation login, independent dashboard state, an extension view and simultaneous reloads in one browser profile. Stop one owned preview and verify its ingress/certificate disappear while the other remains usable. Keep links and expiry in private evidence. Do not stop other people's workspaces or use `--all`.

## Checks

From the repository root:

```sh
bun test extensions/remote-testing/operator
bun run --cwd extensions/remote-testing typecheck
bunx tsc --noEmit --project extensions/remote-testing/operator/tsconfig.json
```

The deployed browser check is required in addition to these tests: local fixtures cannot establish managed TLS issuance, Gateway propagation or Cloud Armor access. Report a pending certificate or unavailable app as incomplete verification.
