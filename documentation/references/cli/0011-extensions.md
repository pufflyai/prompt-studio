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

The Settings → Extensions Upgrade action uses the same update path. Each
extension shows its own version. Git and local development sources keep their
chosen source.

## Installation jobs (0.46)

On the unreleased 0.46 host, every installation path reports jobs through the
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

First-launch catalog jobs survive a runtime restart. Completed jobs are not
replayed, so restarting does not re-enable an extension you later disabled.

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
