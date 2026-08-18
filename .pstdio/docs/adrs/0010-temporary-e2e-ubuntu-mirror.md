# ADR: Temporary E2E Ubuntu Mirror Override

## Status

Temporary workaround for slow Azure Ubuntu package downloads on GitHub-hosted runners. Remove it when the runner mirror can install Playwright dependencies within the existing end-to-end job limit.

## Ideal design

The end-to-end job should use the Ubuntu package source supplied by its GitHub-hosted runner. Playwright should install its browser dependencies without the repository changing runner-owned package configuration.

## External limitation

The `ubuntu-latest` runner currently points Ubuntu packages at `azure.archive.ubuntu.com` through `/etc/apt/apt-mirrors.txt`. Three PS-254 runs spent most or all of the fixed 18-minute job limit downloading Playwright dependencies from that mirror.

The first run never completed the package download. The second took 10 minutes and 14 seconds to install browsers and dependencies, which left only five minutes for the end-to-end suite. A first override edited `ubuntu.sources`, but the runner's mirror-list indirection meant APT still tried the Azure mirror first. That run spent 15 minutes and 20 seconds in the install before the job limit canceled it. Local Playwright passed, and the remote product tests did not report a failure before either cancellation.

Prompt Studio does not own the runner image, its selected mirror, or the mirror's download speed. Raising the job limit would hide the slowdown and would break the repository's fixed performance rule.

## Decision

Before Playwright installs its dependencies, replace the Azure URL in the runner's active APT mirror list with Ubuntu's canonical archive URL. Keep the existing Playwright command and the existing 18-minute job limit unchanged.

## Trade-offs

The end-to-end job no longer uses the runner's nearest configured Ubuntu mirror. It depends directly on the canonical Ubuntu archive instead. This avoids the observed Azure mirror bottleneck but may be slower for runners where the Azure mirror is healthy.

## Isolation

The override is limited to one step in the Linux end-to-end job. It does not change product code, local development, packaged verification, other CI jobs, browser versions, test coverage, or timeout values.

## Removal

Periodically test the workflow without the override. Remove the step and this ADR after three representative pull request runs install Playwright dependencies and finish the full end-to-end job within the existing 18-minute limit using the runner-provided mirror.
