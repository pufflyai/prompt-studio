# Temporary Windows ARM CI HTTP concurrency

Proposed: 2026-10-26

## Intended design

The complete native packaged workload should finish with Bun's normal installation settings and standard awaited filesystem cleanup. Every cold fixture must install the same dependencies into a fresh home and cache. CI must keep its existing assertions and execution allowances.

## External limitation

The packaged runtime uses Bun 1.4.4's installer. Bun owns download and extraction scheduling; application code cannot change that scheduler. The Windows ARM hosted runner still exceeds the core cases' 120-second allowance after selecting job-owned temp storage. In normal full verification [40288189449](https://github.com/pufflyai/prompt-studio/actions/runs/40288189449), features finish at 93.3 seconds and removal completes at 122.8 seconds; defaults complete at 120.6 seconds. All other stable cases pass. Custom removal is slower and is rejected.

Installer profiling places the long phase inside Bun, with process resolution and capture cleanup taking milliseconds. No verified newer Bun release fixes this workload. Changing application source ownership, cache contents or fixture assertions would not repair the installer's scheduling. A clean upstream solution needs an installer or runner change that passes the same complete workload without an override.

## Temporary workaround

Windows ARM CI setup sets Bun's existing `BUN_CONFIG_MAX_HTTP_REQUESTS` to 16 for subsequent job processes. This controls both package installation and Bun runtime `fetch`, as documented in [Bun's environment variables](https://bun.com/docs/runtime/environment-variables). The normal managed installation environment already forwards this variable. Keep this host resource policy in CI; add no application flag, platform branch or persistent state.

Full native comparison [40298072475](https://github.com/pufflyai/prompt-studio/actions/runs/40298072475) passes all 118 stable cases and all three quarantined cases on both Windows architectures with this setting and standard Bun removal. ARM64 core features complete at 114.035 seconds and defaults at 106.872 seconds. The cold caches, dependency graph, browser actions and 120-second allowance remain unchanged. The setting limits concurrent requests, not the number of packages or filesystem operations.

X64 already passes with the default concurrency and keeps it. The adopted configuration must be qualified through the actual shared setup action, without a diagnostic job-level override.

## Limitations

The value is inherited by later Bun application and test processes, so this is a job-wide HTTP concurrency policy, not an installer-only setting. Ordinary extension worker environments filter this variable; managed installer processes retain it. The current dedicated production performance and desktop workflows do not use this setup action, so their P3 environments remain unchanged. Future benchmark callers must define and preserve the HTTP concurrency policy in their measurement contract.

Separate hosted jobs have different load and throughput. These results do not isolate a network, extraction, filesystem or security-policy mechanism, nor prove that this setting alone explains every difference. Lower concurrency can reduce throughput on other hardware, so the override stays limited to hosted Windows ARM CI. The ARM cases retain less margin than x64. Final exact-source full native and nightly qualification remain required; a failed run is not repaired by retrying it.

## Removal

Remove the override when an updated Bun or hosted image completes the same complete cold cases and full native suite with the normal setting. Preserve fresh caches, standard awaited removal, every test and the existing limits in that comparison. Then remove this ADR and the CI environment override together.
