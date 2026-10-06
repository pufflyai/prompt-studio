# Website analytics

The landing website records action-menu openings and window-button clicks through its existing PostHog client.
These custom events measure deliberate interactions with the website chrome.

## Events

| Event | Trigger | Custom properties |
| --- | --- | --- |
| `landing_action_menu_opened` | The action menu changes from closed to open | `page_path` |
| `landing_window_control_clicked` | An enabled far-left window button is clicked | `page_path`, `control`, `windowed_before`, `windowed_after` |

`page_path` is the current public pathname, such as `/blog/`.
It excludes query strings, hashes, menu searches, and article content.
PostHog adds its usual SDK properties separately.

Menu openings include the top-right shortcut button, Command+P or Ctrl+P, and the mobile navigation button.
Closing the menu, rerendering it, or asking an already open menu to open does not record another opening.
In PostHog, count `landing_action_menu_opened` events to measure how often the menu opens.

Window controls use `control: close`, `minimize`, or `zoom`.
`windowed_before` and `windowed_after` are booleans: `true` means a floating window; `false` means the page fills the browser.
Red and yellow enter floating-window mode and are disabled there.
Green toggles between floating and full-page mode.
These controls do not close the browser tab or remove the page.
Filter or group the event count by `control` and `windowed_after` to compare buttons and mode transitions.
Disabled controls and title-bar double clicks do not produce button-click events.

## Ownership

`clients/landing-page/src/services/analytics.ts` initializes PostHog once.
`services/landing-analytics.ts` defines the two custom events.
The navigation hook owns menu-open state and records opening transitions.
The title-bar component records window-button clicks before invoking the existing mode change.
Neither event introduces stored product state or changes the window behavior.

## Validation

Build and run the [isolated landing preview](../../../clients/landing-page/README.md#isolated-preview).
Use Playwright to intercept the PostHog endpoint and inspect the actual SDK event payloads, without sending test visits to the live project.
Use a normal browser user agent and clear the test browser’s webdriver marker in its initial fixture. PostHog excludes known bots and automated browser traffic; keep that production filtering enabled.

1. Open the menu with the shortcut button. Expect one opening event. Close it with Escape; expect no extra opening event.
2. Open and close it with Command+P or Ctrl+P. Expect one more event.
3. On mobile, open it through the navigation button. Expect one more event.
4. Click red, restore with green, click yellow, and restore with green. Expect one button event per enabled click, with matching before/after modes.
5. While floating, verify red and yellow are disabled. Double-click the empty title bar to change mode; expect no button event.
6. Check the shortcut indicator at desktop and mobile widths, in both themes, using pointer and keyboard focus. Clicking or double-clicking it must not drag or resize the window.

The SDK uses its [JavaScript custom-event capture API](https://posthog.com/docs/libraries/js/usage#capturing-events).
Count these custom events directly in PostHog, or group them into an Action for shared reports.
