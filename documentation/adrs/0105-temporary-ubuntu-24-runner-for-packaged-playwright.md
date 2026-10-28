# Temporary Ubuntu 24.04 runner for the packaged Linux check

Proposed: 2026-10-24

## Decision

This is a temporary workaround, not the intended design. The Linux job of `verify-packaged-toolchain.yml`, the `psx_delivery` job of `service-containers.yml` and the `publish` job of `release-packages.yml` run on `ubuntu-24.04` instead of `ubuntu-latest`. All three install Playwright's Chromium. All other jobs keep `ubuntu-latest`.

## How it should work

CI jobs follow `ubuntu-latest`, so the repository tests on the image GitHub currently provides and gets security updates without manual changes.

## External limitation

GitHub moves the `ubuntu-latest` label to Ubuntu 26.04 from 2026-10-19 ([runner-images#14748](https://github.com/actions/runner-images/issues/14748)). The packaged check installs Playwright's Chromium, and the Playwright version this repository uses (`@playwright/test` ^1.60.0) stops with `Playwright does not support chromium on ubuntu26.04-x64`. Every merge-queue run that receives a 26.04 runner fails the required `packaged_toolchain / verify (ubuntu-latest, cli-linux-x64)` job, for example run [40100480507](https://github.com/pufflyai/prompt-studio/actions/runs/40100480507). A clean solution needs a Playwright release that supports Ubuntu 26.04, which is outside this repository.

## Workaround and trade-offs

One matrix entry, the `psx_delivery` job and the release `publish` job name `ubuntu-24.04`. The packaged CLI, browser and extension delivery checks keep their workload, limits and assertions. The trade-off: these jobs do not run on the newest image until the pin is removed. `psx_delivery` also runs when the release workflow builds containers, so without the pin a 26.04 runner would block the release. Without the pin on `publish`, nightly run [40139112300](https://github.com/pufflyai/prompt-studio/actions/runs/40139112300) could not publish.

## Limitations

Only these two jobs are pinned. Another job that installs Playwright browsers on `ubuntu-latest` would fail the same way when it receives a 26.04 runner.

## Removal

When a Playwright release supports Chromium on Ubuntu 26.04, upgrade `@playwright/test`, set all three jobs back to `ubuntu-latest`, confirm the packaged Linux check passes on a 26.04 runner, and delete this ADR.
