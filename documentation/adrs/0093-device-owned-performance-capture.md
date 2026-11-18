# Device-owned performance capture through public extension APIs

Proposed: 2026-10-14

Status: Accepted; implementation and release validation are in progress in PS-724.

## Context

Electron process metrics omit the separate Bun runtime. A renderer can draw smoothly while that runtime is blocked. The Performance tool also needs a public way to place controls in Developer settings. The mission assigns privileged host measurements to core and monitoring presentation to an extension.

## Decision

The device host owns one opted-in capture, one external process observer, one backend responsiveness probe, and one bounded recording writer. Opening a view or subscribing does not create a collector. Disabling cancels work and clears live history. The existing device preference remains the sole enabled preference.

Read CPU time and process memory from the operating system outside the process under observation. Keep platform adapters isolated: macOS process resource usage, Windows process information, and Linux procfs. Preserve process start identity so PID reuse cannot join two process histories. Physical footprint, resident memory, private commitment, and heap are distinct metrics. Missing metrics are null. Do not add shared working sets into an exact application total.

Time an authenticated backend request from the host. Report timeouts separately from finite response times. This measures responsiveness, including network delay for remote hosts; it does not diagnose a cause. A local process reading cannot describe a remote runtime.

Version 2 snapshots extend the existing snapshot endpoint with a shared timestamped capture. Keep version 1 readers supported during rollout. The CLI, extension client, and existing monitor read this same capture. The collector does not own performance budgets: each benchmark retains its named operation, fixed workload, and approved limits.

Expose permission-checked `performance.read` and `performance.control` webview capabilities. Control additionally requires a local user interaction. The runtime has no route that can change the device preference. Subscriptions belong to their webview connection and are disposed when it disconnects.

Export `workbenchSlots.developerSettings` using the existing settings-panel contribution model. Resolve scope and location by the host-owned target, not a substring of a slot identifier. Embedded controls dispose independently of the shared panel and other contributors.

## Recording bounds

The live capture retains at most 150 samples and 512 KiB of encoded sample data. At the existing two-second interval this normally covers five minutes; actual timestamps and gaps remain authoritative. The recorder retains four files of at most 1 MiB each, rotates whole JSONL records, and uses the existing per-user protected directory mechanism. Records contain numeric measurements and capture/process identity, never conversation content, raw process output, credentials, or source paths. A macOS arm64 cost probe with the packaged observer recorded 100 samples: 277 ms for cold observer startup, 0.31 ms steady median and 0.80 ms steady p95 for the external process read, local response, and recording write combined. This serial probe excludes Electron metrics and is not an application performance budget. The existing two-second cadence stays unchanged; Windows/Linux release measurements remain required.

## Delivery

PS-724 publishes the host and SDK primitives first and preserves the working internal widget during that rollout. PS-725 then moves the existing widget into the Performance extension using the published SDK minimum. PS-910 adds the combined response-time, CPU, and memory presentation and benchmark consumption. This decision does not authorize bypassing their release dependency.

Core now exposes recording export, runtime owner counters, explicit capture ownership/disposal, and an independently packaged consumer. The core ticket remains incomplete until the supported packaged platform matrix passes and the host/SDK release is published. Native macOS tests alone do not establish Windows or Linux support.
