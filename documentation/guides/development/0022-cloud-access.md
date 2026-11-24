# Connect people and agents to cloud workspaces

Cloud access gives each person or ephemeral agent its own short-lived PocketCoder
credentials. A host-side client installs Cloud Workspaces and Remote Testing,
loads the deployment's settings and approved manifests, and renews their named
connections. It uses the public runtime API; extension code never reads controller
keys. Governing intent: RB 1.A.3, RB 1.A.5 and RBE 22.A.1.

This is a separately deployed service, not Prompt Studio Cloud project sync.
Installing the repository does not create a deployment or Google permissions or a Microsoft app registration.

## Operator setup

Run `services/cloud-access` behind an HTTPS ingress. The service listens on
loopback by default; set `HOST=0.0.0.0` when ingress reaches a container interface.
Use one replica and a persistent, private state directory. The client acquires a
runtime-home lock before changing connections, since these connections are global
on that device. Stale process claims are recovered automatically.

Provide config and state paths, and choose one issuer authority source:

| Variable | Value |
| --- | --- |
| `CLOUD_ACCESS_CONFIG` | Absolute path to operator-owned JSON configuration |
| `CLOUD_ACCESS_ADMIN_SOCKET` | Recommended: private PocketCoder admin socket mounted only into the central service |
| `CLOUD_ACCESS_ISSUER_FILE` | Alternative: private PocketCoder bearer key file, or a key response with a top-level `token` |
| `CLOUD_ACCESS_STATE` | Persistent directory for bounded run grants |

Use exactly one issuer source. With the private admin socket, the service obtains
bounded two-hour owner credentials and refreshes them before they become too short
to issue a client session. It uses fresh request IDs and `replace:false`, preserving
other operators' owner keys. This authority never leaves the central service.
Socket access is equivalent to controller administration; mount it only into this
trusted service, never an agent VM.

The file alternative is reread on issuance and requires operator-managed rotation.
Its scopes and template grants must contain the target principals' permissions;
a fixed managed-principal list cannot administer dynamically created run principals.
PocketCoder rejects a child expiry beyond the issuer's remaining lifetime, so renew
file-based authority with at least `sessionSeconds` plus a margin remaining.

Give the central service's attached Google identity permission to sign as the
configured signer account. Give that signer account object access to the run bucket.
Set bucket lifecycle rules to remove old sources and logs. The service stores its
own storage-token signing key in the private state directory; preserve it across
restarts. Keep that key, issuer files and actual configuration outside source.
Agent identities need no bucket-wide access or signing permission.

Start the service from a checkout with dependencies installed:

```sh
bun run --cwd services/cloud-access start
```

The [service package](../../../services/cloud-access/package.json) also builds
standalone `dist/server.js` and `dist/cli.js` entry points. The
[Dockerfile](../../../services/cloud-access/Dockerfile) uses the repository root as
its build context. Mount the config, issuer and state paths at runtime.

Configuration shape (replace placeholders; use approved rendered manifests with
real runtime image pins, not these abbreviated examples):

```json
{
  "controllerUrl": "https://controller.example.com",
  "audience": "https://access.example.com",
  "humanAudience": "YOUR_GCLOUD_OAUTH_CLIENT_AUDIENCE",
  "microsoft": {
    "tenantId": "11111111-1111-4111-8111-111111111111",
    "clientId": "33333333-3333-4333-8333-333333333333"
  },
  "humans": [
    { "subject": "GOOGLE_ACCOUNT_SUBJECT", "principalId": "00000000-0000-4000-8000-000000000001" },
    {
      "provider": "microsoft",
      "subject": "11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222",
      "principalId": "00000000-0000-4000-8000-000000000002"
    }
  ],
  "launchers": ["LAUNCHER_SERVICE_ACCOUNT_SUBJECT"],
  "templates": ["remote-tests", "remote-tests-branch", "prompt-studio-preview", "prompt-studio-preview-branch"],
  "workloadRoles": ["runner", "publisher"],
  "sessionSeconds": 900,
  "maxRunSeconds": 28800,
  "settings": {
    "templateName": "remote-tests",
    "templateVersion": "APPROVED_VERSION",
    "testCommand": "bun install --frozen-lockfile && bun run test",
    "timeoutMinutes": 60,
    "storageBucket": "YOUR_BUCKET",
    "signerAccount": "signer@YOUR_PROJECT.iam.gserviceaccount.com"
  },
  "manifests": {
    "tests": { "metadata": { "name": "remote-tests" }, "spec": { "version": "APPROVED_VERSION" } },
    "preview": { "metadata": { "name": "prompt-studio-preview" }, "spec": { "version": "APPROVED_VERSION" } }
  }
}
```

Google ID token signatures, issuer, audience, subject, issued-at and expiry are
verified against Google's public signing keys. Human tokens additionally require
verified email. Authorization uses the stable Google `sub`, not an email supplied
by the client. Pin `humanAudience` to the OAuth client actually used by the team's
gcloud installation. Human and workload audiences must differ. Do not accept
arbitrary audiences or obtain these values from an unverified enrollment request.

The optional `microsoft` block enables Microsoft sign-in. Register a public-client
application in the intended Microsoft tenant and enable public client flows for
device-code sign-in. The `clientId` is its public application ID; no application
secret is needed. Pin an explicit tenant GUID, rather than `common` or
`organizations`. For personal Microsoft accounts, use the consumer tenant GUID
`9188040d-6c67-4c5b-b112-36a304b66dad` and an application registration that supports
personal accounts. A deployment enables one Microsoft tenant at a time. Restart
the broker after changing provider audiences, tenant or application IDs.

Microsoft tokens use that tenant's signing keys and exact v2 issuer, audience,
expiry and stable `tid`/`oid` claims. Microsoft people use
`provider: "microsoft"` and `subject: "TENANT_GUID:OBJECT_GUID"`; obtain these IDs
from the tenant directory, never from an unverified enrollment request. Existing
Google people default to `provider: "google"`. Email and display names never
supply authorization or link accounts across providers. Each configured login
identity owns a distinct principal. Microsoft identities cannot act as VM launchers.
See Microsoft's [ID token claims reference](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference)
and [device-code setup](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code).

Each person needs a distinct existing PocketCoder principal with the approved
template grants. `roles` on a human entry can restrict the default dashboard,
runner and publisher roles. Publisher keys are limited to configured `-branch`
template families. Removing a person prevents renewal immediately; existing keys
expire within `sessionSeconds`. For immediate removal, revoke that principal's
keys in PocketCoder too.

Policy changes are read on each request. Restart to change controller origin or
Google audiences, storage bucket or signer. Run permissions are captured when registered; later policy can
narrow them during renewal, but cannot expand the registered authority.

## A colleague's machine

Prerequisites: Bun, Git, gcloud, Prompt Studio running with a locally linked
project, and a trusted current Prompt Studio checkout with dependencies installed.
The Google account needs enrollment permission in the service policy. Storage
access uses broker-issued object URLs, so colleagues do not need bucket or signer
IAM permissions.

```sh
bun services/cloud-access/src/cli.ts connect \
  --broker https://access.example.com \
  --root /absolute/project \
  --login
```

Omit `--login` when already signed in. This uses the existing gcloud browser login;
there is no second OAuth implementation or native login screen. The client keeps
running and refreshes the host's connections before expiry. Run it through the
user's login-service manager for automatic startup. Pass `--checkout` when the
trusted extension source lives elsewhere, and `PSTDIO_HOME` for a non-default host.
The client rereads `runtime.json` after a host restart.

The installer replaces these two private extensions from the supplied checkout.
Its preview helper lives in the private Prompt Studio home, outside uploaded
project source. Configuration output contains expiry times, not keys. A failed
renewal retries with bounded backoff; expired connections are removed, and a
normal supervisor shutdown clears its connections. An abruptly killed process
cannot renew; its issued keys still expire at their original deadlines.

## An ephemeral VM

Attach a restricted Google service account to a Compute Engine VM. Its identity
must be able to authenticate to the enrollment service. Do not give a shared agent
service account bucket-wide object access or signing authority. The central service
checks the current grant and signs URLs only under that principal's object prefix.
No personal gcloud login or service-account JSON key is copied into the VM. Run each agent's Prompt Studio host with its private
home outside its project source.

The trusted launcher obtains the VM's identity from the cloud provisioning result
and registers a run before starting its client:

```json
{
  "runId": "00000000-0000-4000-8000-000000000002",
  "subject": "VM_SERVICE_ACCOUNT_SUBJECT",
  "instance": {
    "project_id": "YOUR_PROJECT",
    "project_number": "123456789",
    "zone": "europe-west1-b",
    "instance_id": "987654321"
  },
  "deadline": "2027-01-01T12:00:00.000Z"
}
```

Use a fresh run ID and an actual future deadline within `maxRunSeconds`. On the
trusted launcher's Google-hosted machine, with the above record outside source:

```sh
bun services/cloud-access/src/cli.ts register \
  --broker https://access.example.com --identity metadata \
  --grant-file /private/run.json
```

The service creates a dedicated PocketCoder principal for the run. It rejects
duplicate run IDs and lets only the registering launcher revoke that run. Agents
cannot register grants, choose scopes or select a principal. Shared service
accounts require the signed Compute Engine project, zone and instance binding.
The verifier ignores additional Google instance claims while checking these
fields. The launcher must obtain them from trusted provisioning data, never from
the agent's self-reported request.

In the VM entrypoint, start Prompt Studio and then supervise enrollment:

```sh
bun services/cloud-access/src/cli.ts connect \
  --broker https://access.example.com --identity metadata \
  --run-id 00000000-0000-4000-8000-000000000002 \
  --root /workspace/project
```

The client requests an audience-bound full identity token from Google's metadata
server. Remote Testing uses a fourth named connection, **Cloud run storage**, to
request object URLs from the service. Neither gcloud nor Google storage credentials
are needed in the VM. Raw object names are restricted to source archives and run
logs, and the service adds the authorized principal prefix itself. URL expiry is
bounded by the registered run deadline. Already issued object URLs remain usable
until their own expiry; revocation stops further signing immediately. For GKE, use a unique Google service-account subject
per run when full Compute Engine instance claims are unavailable. A subject with
no instance binding cannot be registered twice within grant retention. External
cloud federation can supply a Google identity through an attached identity
provider, but this client currently implements gcloud and Google metadata sources
only; it does not implement arbitrary OIDC providers.

At run completion, the trusted launcher calls `revoke --identity metadata
--broker https://access.example.com --run-id UUID`. This marks the grant revoked
before calling PocketCoder to disable the principal and revoke its keys. If the
controller is unavailable, renewal stays denied; retry revocation to finish
disabling existing keys. Every issued key expires no later than the registered
deadline regardless. Grants are retained for seven days after their deadlines;
PocketCoder owns the retention of its principal and key audit records.

## Previews

Configure `previewHelper` in the service's operator configuration to enable
previews. This helper runs centrally and accepts a workspace ID and maximum
expiry as positional arguments. It returns `{ "url": "https://...",
"expiresAt": "..." }`. It must bound access by that expiry, including any login
session, and should return within 45 seconds; clients may retry while a deployment
warms up. No issuer key is passed to the helper.

The service first checks workspace ownership with a short-lived credential for
the caller's principal. It rechecks the run grant before returning the link and
rejects a helper result that outlives the grant. The generated local helper calls
this endpoint, so agent machines need no Kubernetes operator access. Existing
ingress capacity still applies. This does not add simultaneous preview hostnames.

## Validation and rollout

Run `bun run --cwd services/cloud-access typecheck`, its focused P0/P1 tests and
Remote Testing's Google-token tests. Tests use locally signed tokens and real
HTTP/JWKS servers; they do not prove live Google or controller deployment access.
Before rollout, verify a real approved person, a registered VM, rejection from a
different instance sharing its service account, renewal, revocation and a bounded
preview. Confirm credentials never enter source archives or logs. The deployment prerequisites and live checks remain distinct from fixture-based
source validation.

## Microsoft sign-in on a colleague's machine

After the operator configures Microsoft and adds the colleague's tenant/object ID,
run the same client with Microsoft's identity mode:

```sh
bun services/cloud-access/src/cli.ts connect \
  --broker https://access.example.com --identity microsoft --login --root /path/to/project
```

Follow the displayed Microsoft verification URL and enter the one-time user code.
The client obtains the public tenant/application IDs from the broker, so the
colleague does not configure application IDs or secrets. It requests only OIDC
`openid`, `profile` and `offline_access` scopes. The existing supervisor installs
shared setup and renews the named connections. Later restarts and preview helpers
reuse the private cache without `--login`; if tenant policy requires interaction,
run the command with `--login` again. This is the
[MSAL device-code and silent-refresh flow](https://learn.microsoft.com/en-us/entra/msal/javascript/node/acquire-token-requests).

MSAL's refresh cache is stored outside the project at
`$PSTDIO_HOME/cloud-access/microsoft/TENANT_GUID-CLIENT_GUID.json` (the default home
is `~/.pstdio`). Writes are atomic and locked; the directory uses mode 0700 and
files use mode 0600. The cache is protected by the local account's filesystem
permissions, not OS-keychain encryption. Treat it as a private login credential:
keep it out of source uploads and shared backups. Tokens and raw provider errors
are never printed; only the interactive verification instructions are displayed.
To forget this login, stop the supervisor and remove that tenant/application's
cache file. On renewal failure, connections are removed when their existing
bounded credentials expire.

Live Microsoft sign-in requires the operator's tenant and app registration. Local
protocol/JWKS fixtures qualify code paths, not tenant consent, Conditional Access,
personal-account compatibility or real browser sign-in. Record those checks on
the deployed service before rollout. VM Google workload identity, central Google
storage signing and run grants continue to use their existing operator setup.
