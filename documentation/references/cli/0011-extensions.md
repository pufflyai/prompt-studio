# Extensions

Install extensions, share package files and request compatible updates from a linked project.

## Install and update

~~~bash
pst extensions add pstdio.pstdio-notes
pst extensions update pstdio-notes
pst extensions check
~~~

Stable hosts install core extensions from their own release tag, so an update
arrives with the next Prompt Studio release. A host configured for the PSX extension registry
can receive a core extension update independently of Prompt Studio. It selects
the newest released version its extension API supports. Withdrawn versions are skipped. A refused package or failed install
keeps the working extension. Installed extensions keep running when the registry
is unavailable.

The Extensions Upgrade action uses the same update path. Each
extension shows its own version. Git and local development sources keep their
chosen source.

## Installation jobs (after 0.46.0)

On `main`, after the 0.46.0 host, every installation path reports jobs through the
same service. Inspect progress or retry a failed job:

~~~bash
pst extensions installations
pst extensions installations <job-id>
~~~

The public client exposes `client.extensions.installations()` and
`client.extensions.retryInstallation(id)`. The HTTP routes are
`GET /v1/extension-installations` and `POST /v1/extension-installations/{id}/retry`.
Jobs report queued, running, completed, or failed state. Retrying a completed job
does nothing. An atomic published extension set retries together because it
cannot partly activate.

Explicit catalog jobs survive a runtime restart. Completed jobs are not
replayed, so restarting does not re-enable an extension you later disabled.

Disabling is project-scoped and survives restart. A new project still receives installed
configured defaults enabled. Uninstalling a shared managed source records deliberate removal;
startup and later project setup do not silently reinstall it. Explicit installation clears that
removal and enables only the requesting project, preserving other disabled instances. Host-required
extensions retain their existing required policy.

## Share a package

~~~bash
pst extensions pack ./my-extension --out-dir .
pst extensions add ./alice.notes-1.0.0.tgz
~~~

The package name contains its full extension ID and version. Packages include
the extension manifest and runtime files. Use the manifest's files list to choose
what to share. Dependency installation and extension validation happen before
replacement.

## Run extension commands

~~~bash
pst alice.notes list
pst bob.notes list
~~~

The namespace is the extension's full publisher and name. A deprecated name-only
namespace works while exactly one enabled extension uses that name. Ambiguous
names fail and list the full-ID choices. Declared global aliases such as
pst tickets keep their short form.
