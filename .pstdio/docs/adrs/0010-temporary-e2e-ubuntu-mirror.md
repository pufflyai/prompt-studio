# ADR: Temporary E2E Ubuntu Mirror Override

## Status

Retired. No CI job rewrites the Ubuntu package mirror or installs Playwright system dependencies.

Linux UI, CLI, and packaged/Vite jobs now use the version-matched Playwright image with browsers and system libraries already installed. Run 34570969868 also stalled on the canonical archive: its packaged job spent nearly 15 minutes downloading system libraries and reached the unchanged 18-minute limit before tests started. A prebuilt browser environment replaces the mirror override for those jobs.

Native Linux desktop runners already include every required Electron library, Xvfb, Liberation fonts, and emoji fonts. The install log for job 103182783491 confirms this; its only additions were nine extra font packages and utilities. Job 103189179936 later spent over five minutes repeating that unnecessary APT step. Removing the step keeps native desktop coverage and the existing 15-minute job limit.

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

The former override affected CI setup only. It never changed product code, local development, browser versions, test coverage, or timeout values.

## Removal

The override was removed together with the unnecessary desktop dependency installation. Browser jobs use the Playwright image; native desktop jobs use the libraries already supplied by the runner. Keep this ADR as the record of the retired workaround.
