# Temporary swap reserve for the minimum monitoring host

Proposed: 2026-11-22
Status: Proposed; actual-host workload qualification remains required.

The monitoring extension belongs outside core (RB 1.A.3). The operator requires one smallest VM and reuse of the existing database. The preferred host has enough physical memory for all workers, collection, queries, the OS and Docker without paging.

## External limitation

The nominal 512 MiB VM exposes about 458 MiB to Linux. Its OS and Docker need more than the reference profile's assumed 128 MiB. An isolated application-cgroup measurement does not account for that overhead. The first real start, which also ran an extra relay and manager, became unreachable and required a reboot; its previous-boot kernel journal did not establish an OOM kill. This decision does not claim that paging fixes that incident's cause.

Reserve one 256 MiB swap file on the included root disk, with root-only permissions and no additional paid storage. Lower the shared slice's memory-high threshold to 256 MiB to reclaim earlier, retain the 384 MiB memory maximum, and cap application swap at 256 MiB. Setup preserves existing valid swap, rejects unexpected files and requires at least 1 GiB of root free space after reservation. Keep the four data disks' separate fixed allocations.

## Limitations

Paging adds I/O and latency; it is not additional physical RAM or evidence of adequate capacity. Verify normal encrypted multipart and live traffic, query latency, memory pressure, restart recovery and one actual image rollback on the real host. The deployment remains unqualified until those pass. Do not increase timeouts, omit checks, add machines or resize automatically to obtain a pass.

## Removal

Remove this reserve and its setup when measured workers plus host overhead fit in physical RAM under the supported workload, or the operator explicitly chooses a different host budget. Stop the owned stack and verify enough physical memory before `swapoff`; remove only this deployment's fstab entry and swap file after successful deactivation.
