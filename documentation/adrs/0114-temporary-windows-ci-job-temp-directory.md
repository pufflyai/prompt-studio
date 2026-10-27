# Temporary Windows CI job temp directory

Proposed: 2026-10-26

## Intended design

Hosted Windows jobs should put temporary runtime homes, databases and installation caches in the temporary directory allocated to that job. The runner owns its lifetime. Applications and local tests should keep using the operating system's normal temp API.

## External limitation

The hosted Windows images expose the user-profile directory through `TEMP` and `TMP`, while Actions allocates a separate `RUNNER_TEMP`. The job does not control those image defaults. We cannot make the provider set the normal temp variables to its job directory from application code.

[Comparison 40282116342](https://github.com/pufflyai/prompt-studio/actions/runs/40282116342) runs the same quiet compiled product on both architectures with fresh homes and caches, both complete core cases, standard awaited Bun removal, and the unchanged 120-second allowance. Only `TEMP` and `TMP` placement changes after browser provisioning.

| Architecture | User-profile temp: features / defaults | Job temp: features / defaults |
| --- | --- | --- |
| x64 | Both exceed 120 seconds | 34.23 / 30.31 seconds |
| ARM64 | Both exceed 120 seconds | 114.46 / 108.69 seconds |

The x64 job directory is `D:\a\_temp`; ARM64 uses `C:\a\_temp`. The ARM comparison stays on the same volume. This evidence establishes a directory-placement difference, not a physical-disk or antivirus cause. Separate profiling places the long install phase inside Bun, rather than process resolution or output capture.

## Temporary workaround

The shared CI setup action writes `TEMP` and `TMP` from `RUNNER_TEMP` to the job environment on Windows. Later build and test processes inherit the provider-owned directory through the existing temp API. No application path, dependency layout or cache policy changes. Every cold fixture still allocates its own home and cache; no fixture is prewarmed or reused.

This is a temporary override of the provider defaults. Keeping it in CI setup avoids Windows-only storage rules in the application or test fixtures. The provider's job directory is the intended owner; changing every application caller would put this host concern in the wrong layer.

## Limitations

The comparison uses separate hosted jobs. It does not isolate the underlying storage or image-policy mechanism. ARM64 retains much less margin, so final full native qualification remains required. This does not establish ordinary-user startup performance or change any product performance budget. Native cleanup helpers remain rejected and absent from delivery.

## Removal

Remove the override when the hosted Windows images supply their job directory through the standard temp variables, or an equivalent fresh-directory comparison proves that their defaults complete the unchanged native workloads reliably. Run the complete Windows x64 and ARM64 packaged suites on the resulting configuration before removing this ADR.
