# User-owned cloud execution devices

A cloud device runs the normal Prompt Studio host in the user's own provider
account. It has a separate device identity, private login and signing keys, and
receives the same project and personal keys as the user's other devices. The relay
and account-manager images from [portable deployment](0012-portable-cloud-deployment.md)
are separate services; they cannot execute sessions.

The implementation prepares images and isolated deployment plans. It does not
establish a published image, authorize provider spending, or prove production
start-and-drive-session acceptance. Keep Remote Workspaces until replacement
acceptance, including the 100,000-resource runtime fixture, is recorded.

## Devices page and CLI

Cloud → Devices uses the same public account API as these commands:

```sh
pst devices configure-cloud --file /private/cloud-provider.json
pst devices start --name "Cloud"
pst devices cloud
pst devices stop <device-id>
pst devices start <device-id>
```

The private configuration JSON contains `token`, `region`, `size` and `image`.
`image` is the released device image digest; `token` belongs to the user's own
DigitalOcean account. The native owner saves this configuration privately for the
logged-in account on this controlling device. It never returns the token to the
extension, syncs it with a project, or prints it. Provider power state and account
presence are shown separately; a completed power action is not session readiness.

## Runtime image

The release workflow builds `ghcr.io/pufflyai/prompt-studio/device` from the exact
verified Linux x64 CLI archive. It installs the normal default extension packages
and their package-local agent dependencies during the image build. Runtime startup
copies only these installed extensions into a fresh device home; it never copies
the build machine's database, credential, signing keys or environment identity.
Existing device extensions and user upgrades survive restart.

Use a released immutable image digest, for example
`ghcr.io/pufflyai/prompt-studio/device@sha256:<64 hexadecimal characters>`.
Do not use a service image, mutable `latest`, or a developer checkout. The image
runs as UID 1000, binds the native API to loopback, and exposes no container port.
The complete `/home/bun` directory must persist: it includes `.pstdio`, recovered
project folders and agent authentication. Provider administrators can read the
keys and data on a device they operate (PRD 0014 R16).

The one-time private enrollment envelope is read through
`PSTDIO_CLOUD_BOOTSTRAP_FILE`. The native runtime initializes an absent environment
identity from that envelope, refuses a different existing identity, and saves only
its own device credential. Never copy another device's `native-account.json` or
agent credentials into an image. Agent authentication must be configured separately
for this device before running a session with that provider.

## Portable Compose

For a fresh device managed outside Devices provisioning, run
`pst devices export-bootstrap --name "Cloud device"`. The native owner allocates a
fresh target identity without calling a provider, writes its short-lived envelope
to a generated private path, and prints only the device ID, path and expiry.
`pst devices export-bootstrap <id> --name "Cloud device"` recovers a known native-managed target only
before enrollment; it refuses an already enrolled identity. No arbitrary host file
path or grant is returned through an extension.

Copy [compose.yaml](../../../infra/device/compose.yaml) to an operator folder. Set
`PSTDIO_DEVICE_IMAGE` to the released digest and `PSTDIO_DEVICE_BOOTSTRAP_FILE` to a
private enrollment envelope supplied by the logged-in native account owner.
Restrict that file to its owner and keep it out of source control. Compose mounts
it read-only; the entrypoint copies it privately into the device home so the native
owner can consume it. Do not mount a Docker socket or publish the native API.

After separate deployment authorization, run `docker compose up -d`. A started
container alone is not proof of enrollment or remote execution. Confirm the device
appears online in the account, receives its cloud projects and accepts a remote
workspace/session command from another device of the same user. Then verify
follow-up, approval and interruption, and stop/start without changing identity.
Remove the operator's spent bootstrap file after successful enrollment.

`docker compose stop` keeps the home volume. Use `docker compose start` to resume.
Do not use `down --volumes` on a home that should survive. Device removal at the
account service revokes future Cloud access; it does not delete provider resources
or data already on disk.

## DigitalOcean plan

Execution devices need durable local state. DigitalOcean App Platform's filesystem
is ephemeral and it supports no persistent volumes; the device module uses a
Droplet instead. Its Docker container keeps `/home/bun` on the Droplet disk and uses
outbound relay connections. A firewall blocks inbound traffic. A stopped Droplet
continues to incur provider charges; shutdown preserves the device and its disk.

[The Terraform module](../../../infra/device/terraform/main.tf) is an alternative
resource owner to Devices/CLI provisioning. Do not manage a native-created Droplet
through this module too. Terraform state and provider user-data contain the
short-lived bootstrap envelope: protect them as private operator data and do not
save plan output in source control. Account credentials and project keys never
belong in Terraform inputs.

Validate only with synthetic data:

```sh
terraform -chdir=infra/device/terraform fmt -check -recursive
terraform -chdir=infra/device/terraform/validation init -input=false
terraform -chdir=infra/device/terraform/validation validate
DIGITALOCEAN_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  terraform -chdir=infra/device/terraform/validation plan -refresh=false -input=false
```

The validation directory never applies or contacts an existing deployment. An
actual deployment needs a separately reviewed concrete resource/image plan and
provider account owner action. No such action is part of local qualification.

## Isolated image verification

The image producer consumes the immutable release archive, builds once, and saves
its exact image bytes and source identity as `service-container-device`. Production
validation consumes that archive; publication uses the certified artifact IDs.
The image smoke runs with networking disabled and proves preinstalled default
harnesses, foreground startup and stable identity after stop/start. It does not
claim Google login, project key delivery or remote-session acceptance. Those need
the isolated authenticated multi-device tests and later actual deployment evidence.
