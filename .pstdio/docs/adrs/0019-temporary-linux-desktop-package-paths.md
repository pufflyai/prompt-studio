# Temporarily use space-free Linux desktop package paths

## Status

Temporary workaround for PS-219. Remove the path restriction when Electron's
Linux SUID sandbox supports executable paths containing spaces.

## Ideal design

A packaged application should start with its sandbox enabled from any valid
installation path. Its display name should not restrict where it can be installed.

## External limitation

[Electron issue 44414](https://github.com/electron/electron/issues/44414) documents
a Linux SUID sandbox launch failure when the executable's full path contains a
space. The 0.31.0 native Linux release reproduced that failure on Electron 43.3.0.
All three packaged tests exited before readiness with `failed to execvp`, reporting
the executable path only as far as `out/Prompt`.

The sandbox launches its child processes inside Electron and Chromium. Our
TypeScript launcher already passes the executable and arguments separately.
Changing its shell quoting cannot repair the internal launch. Disabling the
sandbox would break the desktop security contract.

## Decision and trade-offs

Use `prompt-studio` for the Linux package directory and executable. Keep
`Prompt Studio` as the visible application name and desktop-entry name. The
Debian package installs under its normal space-free system path. Document that
the portable archive must also be extracted under a path without spaces while
this upstream defect remains.

This is a temporary restriction, not the intended installation contract. A user
cannot currently run the portable SUID-sandboxed application from a parent
directory containing spaces.

## Isolation

The workaround belongs to desktop package naming and path resolution. Forge,
fuse verification, packaged tests, and the Linux desktop entry use the same
package layout. Runtime ownership, sandbox permissions, and application data
paths do not change. Tests must launch the real packaged app with the SUID
sandbox configured; renaming only a test copy would hide the shipping defect.

## Removal

Upgrade to an Electron release that fixes the upstream issue. Prove packaged
startup and lifecycle tests on Linux with spaces in both the installation parent
directory and executable name. Then remove the portable-path restriction and
this temporary decision. The conventional Linux executable name can remain as
an ordinary packaging choice.
