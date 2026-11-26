# Use a single database baseline for 0.49

Proposed: 2026-11-26
Status: Proposed

A fresh installation and a rebuilt database should have the same schema and migration history.
0.49 creates new installations from one generated migration. The released 0.46 journal
remains a frozen input for converting populated homes, including 0.48 and early 0.49 nightlies.
After conversion has committed and the released tables have been retired, the database adopts
the 0.49 journal in one transaction. A fully converted database can adopt that journal in place.
Future releases append to the 0.49 journal.

The pre-0.46 retirement policy still applies to unsupported older engines. The 0.48 upgrade
preserves saved projects and keeps the 20-second limit through the first saved edit.

## Proposed follow-up for update ownership

Give core one update coordinator. It would select a complete release for the
chosen channel, stage the exact compatible first-party tools with it, and report
progress through the first usable project. Desktop would continue to use its
native installer. The database package would own data conversion, and each
extension would own changes to the meaning of its records. Desktop, CLI and
manual installs would reach the same local upgrade path when the new host starts.
Stage required downloads before installation so an offline restart can finish.
The coordinator is a separate change from the 0.49 importer.

## Removal

Keep the frozen journal, converter, and one-time first-party tool update while a
supported release can upgrade directly from a pre-0.49 database. During that
period test direct upgrades from the oldest supported release and from 0.48,
including editing a saved project and reopening it after restart.

Once the minimum supported source database is 0.49, remove those upgrade paths,
their frozen SQL and their old-format fixtures together. Verify a fresh install
and an upgrade from the new minimum supported version. Existing recovery copies
belong to the user. Retiring the converter does not delete those copies.
