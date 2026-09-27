# Temporary Windows CI Defender exclusions

## Intended design

The Windows CI job should run the same unit tests as Linux within the same limits,
on a runner whose own background services do not add work to every file the tests
write. Test limits describe our code, not the runner image.

## External limitation

GitHub's `windows-latest` image runs Microsoft Defender real-time scanning. Many
tests write thousands of files: every on-disk PGlite database, bun installs, builds,
and packaged-process fixtures. Defender scans each write.

Before this change, the `pstdio-db` `createDb` tests took 1.8–3.8 s on passing Windows
runs against Bun's 5 s default, and spiked past it on slower runners (11 s in the
#776 merge queue run). The packaged fixture timeout test failed the same way, and
also with `EBUSY` when it removed its temp folder.

The repository does not control the hosted image, and the tests cannot opt out of
scanning themselves.

## Temporary workaround

The `windows_test_and_build` job excludes the temp folders, the workspace, and the
bun cache from Defender scanning (`Add-MpPreference -ExclusionPath`) before checkout.

Measured on [run 36302698256](https://github.com/pufflyai/prompt-studio/actions/runs/36302698256)
against two passing main runs (36298072905, 36275321189):

| Step | Before | After |
| --- | --- | --- |
| Install dependencies | 75–78 s | 63 s |
| Build monorepo | 97–100 s | 65 s |
| Lint monorepo | 90–98 s | 58 s |
| Test monorepo (non-e2e) | 700–720 s | 475 s |
| `createDb` template upgrade | 2.8–3.8 s | 1.9 s |

No test limits changed.

This is a temporary runner workaround, not the intended design. It only removes
scanning from a disposable CI runner. Users' machines keep Defender on, so it says
nothing about the product's speed under an antivirus scanner.

## Isolation

The step lives only in the `windows_test_and_build` job of
`.github/workflows/test-and-build.yml`. Do not add it to release, packaging, local
development, installers, or the application.

## Removal

Remove the step when the hosted Windows image stops scanning these folders, or when
the job moves to a runner without real-time scanning. Before removing it, confirm the
`createDb` tests stay well under Bun's default limit on several Windows runs.
