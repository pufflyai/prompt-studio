# Temporary Windows database publication retries

Proposed: 2026-10-24

Status: Accepted.

## Intended behavior

The engine upgrade adapter in ADR 0098 prepares and verifies a closed private database before publishing it with atomic directory renames. The existing external database lock excludes other writers throughout preparation, publication, and recovery. Diagnostic readers should not prevent a completed upgrade from opening.

## External limitation

Windows can refuse to rename a directory while a reader holds a handle to a contained file. Closing PGlite and its transfer workers does not close handles owned by other processes. The released-storage packaged smoke test reads directory metadata during upgrade to measure disk usage; the queue observed `EPERM` while moving the closed legacy home into its recovery directory.

Microsoft documents the [directory rename restrictions](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/ns-ntifs-_file_rename_information) and [delete-sharing behavior](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew). Node's filesystem rename API reports the failure without a way to await the conflicting reader. Checking for open handles first would introduce another race. Coordinating every external reader is not possible.

## Temporary workaround

Isolate a bounded retry in `pstdio-db/src/db/rename-pglite-home.ts`. On Windows, retry only `EPERM`, `EACCES`, and `EBUSY` from database directory publication or restoration. Wait 10, 20, 40, 80, and 160 milliseconds between attempts, for at most 310 milliseconds of added waiting. A successful first attempt adds no waiting. Other errors and other platforms fail immediately.

Keep the existing external lock, staging ownership, candidate verification, atomic rename steps, and interruption recovery. Check cancellation before each attempt. A final failure preserves the original error and existing recovery files. Do not retry an entire upgrade, suppress a failed publication, or change any test deadline or performance budget.

## Limitations

The filesystem error codes do not distinguish every temporary sharing failure from a permanent permission failure. Permanent failures therefore receive the same bounded wait before being reported. Handles retained beyond the retry window still prevent publication. Cancellation during a wait is observed before the next attempt, within 160 milliseconds.

This does not qualify Windows directory flushing or power-loss recovery. It does not make concurrent database writers safe and does not bypass the database lock.

## Validation

A native Windows regression holds an actual file reader in a separate process, confirms the directory cannot move, releases the reader, and requires publication to preserve its bytes. The existing home-recovery tests cover both rename boundaries and cancellation. The released 0.45 packaged upgrade retains its data, asset, retry, deletion, disk-observation, and restart workload on every existing platform.

## Removal

Remove the retry helper when the supported Windows runtime can publish these directories atomically while readers finish, or when database homes no longer move during startup. Keep the native reader regression to prove that supported publication still succeeds. When the engine adapter in ADR 0098 is removed, remove its publication calls. Keep the helper only if the replacement still moves database directories and the native regression still demonstrates the Windows sharing restriction.
