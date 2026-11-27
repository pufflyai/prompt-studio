# Two Cloud Workspaces team harness

Run this explicitly from a local operator machine. Nothing registers it with CI or test discovery.
It uses the configured Cloud Workspaces / Remote Testing companion to upload the selected checkout
and start **two independent Cloud Workspaces**, each with its own native process, home, database,
account and device identity. A disposable Kubernetes Job supplies PostgreSQL and RustFS; the owner
workspace runs the source checkout's actual account manager and Relay. The member downloads its
required extension through that manager and object storage, rather than sharing the owner's files.

The identity provider is the existing signed OAuth protocol fixture. Native login, provider token
validation, one-time callback exchange and device enrollment run normally. No Microsoft password or
MFA is involved. This validates team/sync behavior with synthetic Microsoft identities; it **does not
qualify real Microsoft consent, tenant policy, MFA or the currently deployed hosted services**.
The privileged fixture controls bind only to owner-pod loopback and are not part of the production
server build. Credentials stay in private local state or the owned pods, outside uploaded source.

Each run installs narrow network policies for its two pods and storage. This is required on
[GKE Dataplane V2](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/network-policy#ipblock_behavior_in_gke_dataplane_v2),
where broad IP rules exclude pod traffic. The member can reach the manager/Relay; only the owner
receives database/object-store credentials and storage access. Cleanup removes these policies too.

## Prerequisites

- Bun and `pst`, from a project linked to the configured Remote Testing companion.
- `pst pocketcoder.remote-testing status` reports available.
- A configured `kubectl` executable or wrapper with access to that controller's namespace. The runner
  needs permission to create/delete its own Job, Services, Secret and NetworkPolicies, and exec into the two workspace
  pods. It does not change controller deployments or use the shared browser preview bridge.
- Network access from both workspace pods to the namespace's disposable services and the package
  registry. The source build installs the frozen monorepo dependencies and builds the dashboard.

## Run the complete scenario

```sh
bun scripts/dev/cloud-team.ts run --kubectl /path/to/configured-kubectl-wrapper
```

Default namespace is `pocketcoder`; use `--namespace NAME` when the controller uses another namespace.
Use `--source /absolute/checkout` to select another checkout, including its non-ignored working files.
The runner prints a private evidence directory. Use a directory outside source when supplying
`--directory`, and do not publish its contents wholesale: it contains a disposable TLS private key.

The scenario checks:

1. Two different signed-in accounts and device IDs in separate Cloud Workspace pods.
2. Owner creates a team; member accepts a desktop invite code without email delivery.
3. Joining alone grants no project; an explicit grant reveals one project while another stays hidden.
4. Owner requires a minimal extension; the member automatically downloads and activates it.
5. Synthetic records travel owner → member and member → owner through real encrypted Relay storage.
6. Member cannot disable/uninstall the required extension, release its policy or issue team invites.
7. Owner releases policy; the installed extension remains and member enablement controls return.
8. Owner removes member; after the 30-second access-token lifetime, future edits do not reach the
   removed member. Old downloaded data remains; the owner can still read/write.

A failed assertion exits nonzero. Results and original failures are retained as `results.jsonl`.
The runner stops its own Cloud Workspaces and deletes its labelled disposable backend. `--keep`
retains the setup on success or failure for diagnosis. Jobs and workspace runs have finite lifetimes;
use `down` to remove Services/Secrets too. Nothing touches another run's workspace or project.

## Keep a signed-in pair for exploration

```sh
bun scripts/dev/cloud-team.ts up --kubectl /path/to/configured-kubectl-wrapper
bun scripts/dev/cloud-team.ts test --directory /absolute/printed/private-directory
bun scripts/dev/cloud-team.ts down --directory /absolute/printed/private-directory
```

`up` stops after setup and two-way sync, leaving the owner and member signed in with the extension
managed. `test` is destructive: it releases policy and removes the member. Start a fresh pair for
another complete run. `down` can also clean a partially provisioned pair using its saved state.
Default lifetime is 60 minutes (`--minutes 10..120`). Do not copy real device credentials into it.

The native apps listen on port 3030 inside their separate pods. This runner qualifies public host APIs
and extension commands; it does not provide simultaneous browser preview links or automate clicks in
the unreleased Cloud Team settings UI. That UI and real-provider qualification remain separate checks.
The existing shared preview bridge is not used or reassigned.
