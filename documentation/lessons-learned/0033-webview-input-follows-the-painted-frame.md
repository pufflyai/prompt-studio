# Webview input follows the last painted frame

## When to use

- A browser test clicks inside an extension webview right after the view's popover, panel or tab is shown.
- The click passes Playwright's checks, but the webview's DOM shows no reaction at all.

## Failure

- Extension webviews are sandboxed iframes. Chromium runs them in their own renderer process.
- The browser routes input to that process using hit-test data from the window's last painted frame. If the
  iframe was hidden in that frame, the click goes to the host `<iframe>` element and never reaches the webview.
- Playwright's visibility and stability checks run against the webview's DOM and its own frames. They pass before
  the host window has painted the reopened container.
- On a slow runner the host window can go several hundred milliseconds without painting after a popover reopens.
  In the packaged Performance test, the "Highlight React renders" click was lost this way, so the React Scan canvas
  stayed on screen even though the overlay code was never asked to stop.

## Prevention

- After showing a container that holds a webview, wait until the host has painted it before clicking inside it.
  A trial click on the host iframe (`iframe.click({ trial: true })`) waits for the iframe to stay in place across
  painted host frames. See `openPerformanceDetails` in
  [packaged-performance-helpers.ts](../../clients/desktop/src/e2e/packaged-performance-helpers.ts).
- Waiting for state inside the webview, such as `toBeChecked()`, does not prove that the host has painted.

## Evidence

- In the failing trace, the webview DOM was identical before and after the click, including focus. The passing run
  showed the input change and the pending state immediately.
- The host painted no frame from 40 ms to 370 ms after the reopen. The click was sent at about 200 ms, and the
  next painted frame still had no popover.
- With Electron 43.8.1, a CDP click into a sandboxed iframe sent right after its container left `display: none`
  reached only the host `<iframe>` element in 6 of 6 tries. Waiting for two host animation frames first delivered
  every click.
