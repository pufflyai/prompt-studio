# Refresh standalone lock identities without resolving new dependencies

Bun 1.4.4 retains `workspaces[""].name` in an existing standalone lockfile
when only the package name changes. Both ordinary lockfile-only installation
and forced installation report no dependency changes and preserve the old name.
A successful root workspace install does not inspect each extension's separate
lockfile, and dependency-only metadata checks do not detect this identity drift.

The extension lock synchronizer still asks Bun to maintain each existing locked
dependency graph. It then refreshes only the generated root workspace name from
the manifest, preserving the remaining metadata, formatting, resolved versions
and integrity records. A real-I/O regression renames a package with a locked
dependency and checks that its identity changes while dependency resolutions do
not. The canonical adoption update also compares every generated package graph
with its previous graph.

Use the [maintained lockfile command](../guidance/0007-contributing.md#3-generated-file-exceptions).
Do not delete existing locks to repair a root name: that could resolve unrelated
dependency versions while making an identity-only change look complete.
