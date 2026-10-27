# Temporary Windows CI job temp directory

Proposed: 2026-10-26

## Intended design

Hosted Windows jobs should put temporary runtime homes, databases and installation caches in a temporary directory that the job owns, on storage that suits many small files. The runner owns its lifetime. Applications and local tests should keep using the operating system's normal temp API.

## External limitation

The hosted Windows images point `TEMP` and `TMP` at the user-profile directory on the `C:` system volume. Actions allocates `RUNNER_TEMP` separately. On x64 images it is on a local `D:` disk; the ARM64 image has no second disk, so `RUNNER_TEMP` is also on `C:`. The job does not control the image's volumes or defaults.

Cold packaged fixtures install extension dependencies into fresh homes and caches. The largest is the Planner's production install: 463 packages and 38,354 files (389 MB). Writing those files to `C:` is slow on both architectures. [Install comparison 40476653773](https://github.com/pufflyai/prompt-studio/actions/runs/40476653773) and [40477674585](https://github.com/pufflyai/prompt-studio/actions/runs/40477674585) time the same `bun install --frozen-lockfile --ignore-scripts --production` with a fresh cache (cold) and again with that cache after removing `node_modules` (warm):

| Volume | x64 cold / warm | ARM64 cold / warm |
| --- | --- | --- |
| `C:` system volume | 51.7 / 26.3 s | 47.3–56.1 / 28.3–31.4 s |
| x64 `D:` local disk | 16.7–17.6 / 12.7–13.2 s | not available |
| NTFS virtual disk | 18.6–19.4 / 13.0–13.9 s | 192.1–206.4 / 27.2–30.0 s |
| ReFS Dev Drive | 8.3–16.3 / 3.1–4.2 s | 8.9–21.6 / 2.9–9.7 s |

Defender is not the cause: both images already exclude `C:\` and `D:\`, and excluding the job directory changed little. The warm case does no downloads, so the cost is writing and linking files on that volume. A Dev Drive skips most file system filters, which most likely explains the difference; the exact filter is not identified.

Inside the packaged core cases, the Planner's dependency install took 79.7–91.0 seconds on ARM64 and 17.6–18.1 seconds on x64 ([diagnostic 40474309134](https://github.com/pufflyai/prompt-studio/actions/runs/40474309134)). It made first-project creation exceed the 120-second case allowance on ARM64. The other setup phases are about 1.5 times slower on ARM64.

## Temporary workaround

The shared CI setup action creates a dynamic 50 GB ReFS Dev Drive file in `RUNNER_TEMP`, mounts it, and writes `TEMP` and `TMP` to a folder on it for later steps. The job owns the drive; the hosted runner discards it with the job. Both Windows architectures use the same rule. Later build and test processes reach it through the existing temp API. No application path, dependency layout or cache policy changes. Every cold fixture still allocates its own home and cache; no fixture is prewarmed or reused. No timeout, budget or workload changes.

This is a temporary override of the provider's storage. Keeping it in CI setup avoids Windows-only storage rules in the application or test fixtures.

## Limitations

The temp directory is now on a different volume from the checkout. A test that renames files between the checkout and the temp directory would fail on Windows CI. ReFS also differs from NTFS in small ways, such as larger file IDs. The full Windows suites must pass on this configuration. The drive costs 10–15 seconds of setup per Windows job that uses the shared setup action. This does not measure ordinary-user performance, which still writes to the user's own volume, and it does not change any product performance budget.

## Removal

Remove the override when the hosted Windows images offer a fast job-owned temp volume on both architectures, or when a fresh-directory comparison shows that their defaults complete the unchanged native workloads reliably. Run the complete Windows x64 and ARM64 packaged suites on the resulting configuration before removing this ADR.
