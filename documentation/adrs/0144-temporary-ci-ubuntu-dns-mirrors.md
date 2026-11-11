# Temporary CI mirrors during Canonical DNS outage

Proposed: 2026-11-11

Status: Accepted temporary workaround; native failing-scope qualification pending.

## Intended design

Ephemeral CI runners install the same signed Ubuntu system packages before browser and native installer checks. Repository signatures, suites, components, architectures, package contents, workloads and execution allowances remain unchanged.

## External limitation

[Release verification 43034477994](https://github.com/pufflyai/prompt-studio/actions/runs/43034477994) failed Linux desktop installation and x64/ARM64 browser prerequisites because archive, security and ports Ubuntu names could not resolve. Three required Ubuntu checks in [PR qualification 43033914416](https://github.com/pufflyai/prompt-studio/actions/runs/43033914416) exhausted their allowance before tests started. [Canonical's incident feed](https://status.canonical.com/rss) reports a major DNS outage at 14:26 UTC.

[Fresh-runner diagnosis 43040048802](https://github.com/pufflyai/prompt-studio/actions/runs/43040048802) verified Ubuntu-signed metadata and downloaded the missing libnotify4 package through the Linux Kernel Archives mirror on Ubuntu 24.04 and the current Ubuntu runner image. This establishes an available alternate distribution endpoint, not a product test pass. The repository cannot repair Canonical's DNS service.

## Temporary workaround

Replace Ubuntu archive/security endpoints with the [Linux Kernel Archives mirror](https://mirrors.edge.kernel.org/ubuntu/), and Ubuntu ports with the [MIT mirror](https://mirrors.mit.edu/ubuntu-ports/). Apply one shared action before APT consumers, including desktop installer verification and production performance jobs that do not use the dependency-cache action. Keep the runner's existing Ubuntu archive keyring and Signed-By configuration, all suites/components and package verification. Do not add trust keys, disable TLS or APT verification, substitute direct unverified package downloads, or change the DNS resolver.

This supersedes ADR 0134's Azure-only mirror removal for ephemeral Linux CI runners. Product code and local development do not change. ARM64 mirror qualification and the actual previously blocked checks remain required; a mirror metadata probe alone is insufficient.

Run mirror setup only for the host cache profile. Playwright container jobs use preinstalled system dependencies and run as user 1001 without `sudo`; they neither need nor can perform APT source changes. Merge group [43057942086](https://github.com/pufflyai/prompt-studio/actions/runs/43057942086) failed browser setup on `sudo: command not found`, which stopped the peer database and integration jobs before they completed. Running the action locally as user 1001 reproduces exit 127, including after the root-container adjustment.

## Removal

Restore the Ubuntu archive/security/ports endpoints once Canonical resolves the outage and a first-attempt failing-scope prerequisite qualification succeeds through those endpoints. Restore ADR 0134's Azure exclusion in shared setup; Azure-first behavior requires that ADR's independent removal condition. Remove the DNS workaround action and all call sites together; retain the failure and recovery evidence. No repeated product tests, retries or increased allowances are authorized by this workaround.
