# Temporary Bun bootstrap for browser CI containers

Status: Accepted temporary workaround.

## Intended design

Browser CI uses the version-matched Playwright image, with browsers and their system
libraries already installed. The normal Bun setup action should install the version
declared in the root package manifest without adding operating-system dependencies.

## External limitation

The Playwright image does not include `unzip`. `oven-sh/setup-bun@v2` always uses
that executable to extract a downloaded Bun ZIP. Run 34572727687 failed at this step.
Adding an APT installation would restore the package-download dependency that exhausted
the packaged job's 18-minute limit in run 34570969868.

## Temporary workaround

Use a small Node bootstrap only in Linux x64 browser containers. Download Bun's official
`@oven/bun-linux-x64` registry archive for the version in `packageManager`, extract it
with the image's existing `tar`, verify the executable version, and expose `bun` and
`bunx` through `GITHUB_PATH`. The other jobs keep the official setup action.

This adds a bootstrap script to maintain and still requires the registry download.
It adds no OS package installation, install retries, or timeout increases.

## Isolation and removal

Keep this code in `scripts/ci/setup-container-bun.ts` and call it only from the three
browser job definitions. Do not turn it into a general package installer.

Remove it when the Bun setup action can extract its archive using dependencies included
in the Playwright image, or when that image includes Bun's installer requirements.
Verify a cold container setup and the browser jobs before switching back.

## Evidence

- [Bun setup failure](https://github.com/pufflyai/prompt-studio/actions/runs/34572727687/job/103178179842).
- [Setup action extraction](https://github.com/oven-sh/setup-bun/blob/v2/src/action.ts).
- [Official Bun registry package](https://www.npmjs.com/package/@oven/bun-linux-x64).
