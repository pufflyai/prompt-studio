# Temporary Firefox test application-data home

Proposed: 2026-10-29

Status: Accepted.

## Decision

Give the CLI shutdown test's Firefox process its own application-data home through `CFFIXED_USER_HOME`, using the case's existing temporary home. Keep the real Firefox browser, dashboard event stream, shutdown assertions and existing 60-second test allowance.

## Intended design

Playwright should keep all browser state inside its temporary test profile. Browser tests must not depend on access to a person's browser data or require broader host permissions.

## External limitation

The pinned Playwright 1.60 Firefox build still resolves a separate macOS application-data directory outside its temporary profile. macOS 27 can deny that access and prevent browser startup. [Playwright issue 42768](https://github.com/microsoft/playwright/issues/42768) records this upstream limitation and its fix in a newer Firefox roll. Playwright 1.65 has not been published to the package registry at the time of this decision.

On macOS 27.0.1, the unchanged `main` shutdown test exhausted 60 seconds in `firefox.launch`, before visiting the dashboard. Reinstalling the pinned browser produced the same failure. A clean fix in the browser itself is outside this repository; changing application permissions or using an unreleased dependency is unnecessary.

## Isolation

Set `CFFIXED_USER_HOME` only in the Firefox child environment for this test. Other subprocesses keep their environment. The application-data files stay under the test's existing temporary runtime home. No product code, browser security setting, retry, deadline or test selection changes.

## Limitations

This is a temporary workaround for the pinned browser. The variable changes macOS Foundation's home-directory lookup for Firefox; other operating systems ignore it. The test still runs its original workload, but cannot validate interaction with a person's real Firefox data, which is outside its contract.

## Removal

After upgrading to a released Playwright version containing the upstream application-data fix, verify that the complete shutdown test passes on macOS 27 with no home override and no added permissions. Remove the child environment override and supersede this ADR in that same change.
