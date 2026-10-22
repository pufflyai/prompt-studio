# Extensions

Install extensions, share package files and request compatible updates from a linked project.

## Install and update

~~~bash
pst extensions add pstdio.pstdio-notes
pst extensions update pstdio-notes
pst extensions check
~~~

On a host with PSX support, a core extension update can ship independently of
Prompt Studio. The host selects the newest released version its extension API
supports. Withdrawn versions are skipped. A refused package or failed install
keeps the working extension. Installed extensions keep running when the registry
is unavailable.

The Settings → Extensions Upgrade action uses the same update path. Each
extension shows its own version. Git and local development sources keep their
chosen source.

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
