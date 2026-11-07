# Folder recovery workload

The [PRD 0015](../../requirements/platform/0015-project-data-recovery.md) large workload. One
account's laptop captures a fixed 5 GiB project folder, uploads it, and turns off. A second computer
signs in, downloads every byte and restores the folder through `pst projects folder restore`. Record
sync and a second account must keep progressing while the large files transfer. This is a
diagnostic, not a CI test or a budget.

## Workload

Keep it fixed. Do not shrink it, exclude any of it with `.pstignore`, or raise limits to pass.

- 5 GiB of distinct random files: one 1 GiB file and eight 512 MiB files, the same files as the
  [relay reference workload](../../guides/development/0012-portable-cloud-deployment.md).
- Three compiled hosts with separate homes: the laptop and desktop of one account, and one computer of
  a second account. Each host installs the grouped-storage fixture extension.
- The relay is the packaged wire peer (`packaged-sync-relay.fixture.ts`) on loopback TLS, with blobs
  stored on disk. It keeps each account's private space, keys and project list apart and binds access
  tokens to a device and project, but it is not the deployed relay.
- While the laptop uploads, it saves a record every 3 seconds; a sample completes when the peer holds
  the device's encrypted update to the notes record stream. The second account adds a file and requests a capture every 3 seconds; a sample
  completes when its new copy is published. The desktop repeats the record probe while it downloads,
  and the second account repeats its capture probe. A sample that makes no progress within 120 seconds
  counts as missed.
- After the restore, every file's size and SHA-256 must match the source.

## Run it

```sh
bun run build && bun run --cwd scripts build:host
bun packages/e2e/src/perf/folder-recovery-workload/workload.diagnostic.ts [output-directory]
```

`E2E_PACKAGED_BINARY_PATH` selects another compiled host. The default output is
`.pstdio/extension-storage/pstdio.pstdio-artifacts/folder-recovery-workload` with `results.json`
and `run.log`. The runner needs 25 GiB free in the system temporary folder. Three 5 GiB copies exist
at once: the source, the laptop's recovery store and the peer's blobs while uploading, then the peer's
blobs, the desktop's recovery store and the restored folder after the runner removes the laptop's
files. The rest is headroom, including the start of the desktop's own capture of the restored folder:
the runner stops the desktop right after the restore, before it uploads that folder as its own copy. It removes its hosts and files when it finishes, fails or receives SIGINT or SIGTERM.

## Results, 2026-11-07

Apple M5, 10 cores, 32 GiB RAM, macOS 26 (Darwin 25.5.0), Bun 1.4.4, compiled host from the PS-1069
qualification branch. Other agents were running on the machine, so treat the times as one sample.

| Phase | Time | Throughput |
| --- | ---: | ---: |
| Capture and upload, from sync start to the published copy | 249.6 s | 21.5 MB/s |
| Capture scan, hashing and encryption (inside the row above) | 76.9 s | 69.8 MB/s |
| Upload after the scan (inside the first row) | 171.5 s | 31.3 MB/s |
| Download on the desktop, from sign-in to every byte verified locally (5,181 blob reads) | 191.0 s | 28.1 MB/s |
| Restore through the CLI, including staging, verification and attach | 58.7 s | 91.5 MB/s |

Every restored file matched its source digest. In this run the record probes counted any update the
device sent to the peer, not only the notes stream, so a sample could end on another document's
update; the runner now counts only the notes stream. Every save itself completed. Throughput uses the copy's 5,368,709,263 included
bytes; MB is 10^6 bytes.

| Progress during the transfer | Samples | Missed | Median | Max |
| --- | ---: | ---: | ---: | ---: |
| Laptop record saves during capture and upload | 79 | 0 | 128 ms | 787 ms |
| Second account captures during capture and upload | 61 | 0 | 1,035 ms | 3,881 ms |
| Desktop record saves during download | 61 | 0 | 113 ms | 485 ms |
| Second account captures during download | 42 | 0 | 1,353 ms | 4,577 ms |

Peak resident memory, sampled every 500 ms: laptop 843 MB during capture and upload, desktop
1,261 MB during download and 708 MB during restore, second account 556 MB, and the runner with the
peer 82 MB.

## Limitations

- The packaged peer stands in for the relay, account manager and object store on one machine. It does
  not establish hosted throughput, capacity or cost; hosted acceptance remains PS-789.
- Downloads fetch one 1 MiB chunk at a time and capture runs on the host's main thread. Both bound
  throughput; record saves still completed throughout.
- The desktop's 1.26 GB download peak is the largest memory use in the run and has not been profiled.
- A restored folder is sealed again with new chunk IDs, so the restoring computer uploads the whole
  folder once more as its own copy. The runner stops the desktop before that upload.
