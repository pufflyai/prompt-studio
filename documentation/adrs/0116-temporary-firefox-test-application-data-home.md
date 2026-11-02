# Temporary Firefox test application-data isolation

Proposed: 2026-10-29

Status: Accepted.

## Decision

Give test Firefox processes application-data and local-application-data directories inside each case's existing temporary root. Set Mozilla's `MOZ_APP_DATA` and `MOZ_LOCAL_APP_DATA` only for Firefox launches on macOS through a shared test launch-options helper. Keep Playwright's temporary profiles, real browser, application assertions and existing execution allowances.

## Intended design

Playwright should keep all browser state inside its temporary test profile. Browser tests must not depend on access to a person's browser data or require broader host permissions.

## External limitation

The pinned Playwright 1.60 Firefox build still resolves a separate macOS application-data directory outside its temporary profile. macOS 27 can deny that access and prevent browser startup. [Playwright issue 42768](https://github.com/microsoft/playwright/issues/42768) records this upstream limitation. [Mozilla bug 2078511](https://bugzilla.mozilla.org/show_bug.cgi?id=2078511) describes isolated per-session `MOZ_APP_DATA` and `MOZ_LOCAL_APP_DATA` directories as a workaround that can be removed with the session.

On macOS 27.0.1, the unchanged `main` shutdown test exhausted 60 seconds in `firefox.launch`, before visiting the dashboard. The packaged native-settings check also reaches its 120-second limit before creating a page. Reinstalling the pinned browser produced the same failure. A clean fix in the browser itself is outside this repository.

On 2026-11-02, the published Playwright preview `1.65.0-alpha-2026-11-02`, with Firefox 158 revision 1570, still failed at launch with "Could not find profile folder." Upgrading to that preview does not remove the limitation on this host. The dependency and CI changes were discarded. An isolated probe with the pinned Firefox and the two Mozilla data-directory variables launched, used a page, closed and removed its whole temporary root successfully.

## Isolation

Set the two variables only in the macOS Firefox child environment. The helper accepts the case's existing temporary root; callers retain ownership and their normal cleanup. Each case has distinct data directories, while Playwright still creates a distinct browser profile. Chromium, WebKit and other subprocesses keep their launch options. No product code, browser security setting, retry, deadline or test selection changes.

## Limitations

This is a temporary workaround for the pinned browser. It applies to the CLI shutdown and three packaged browser suites that explicitly launch Firefox. It does not change the macOS home directory or create protected Firefox data beneath a fake home. Packaged cases remove their temporary roots after browser shutdown. The CLI fixture retains its temporary runtime home as before. The test still runs its original workload, but cannot validate interaction with a person's real Firefox data, which is outside its contract.

## Removal

After upgrading to a released Playwright version containing a verified upstream application-data fix, run the complete shutdown test and a packaged Firefox settings case on macOS 27 without either data-directory variable or added permissions. When both pass, remove the helper and its call sites and supersede this ADR in that same change. The observed Firefox 158 preview failure does not satisfy this condition.
