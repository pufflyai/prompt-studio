# Browser Preview

Browser Preview opens a local web application inside a Prompt Studio Main Panel tab.

Open the Command Palette and run **Browser: Open Preview**. Enter an HTTP or HTTPS address, such as `http://localhost:5173`. Each run opens a new tab, even when another preview already uses the same address.

Use the toolbar to reload the page, copy its address, open it in the system browser, or choose a responsive, desktop, mobile, or custom viewport. Open previews and their viewport settings return after a dashboard refresh. Close a preview tab to remove its saved state.

Browser Preview blocks non-web addresses, addresses with credentials, and Prompt Studio's own dashboard and API origins. The embedded page runs in a sandbox and receives no Prompt Studio host bridge.

Some sites block iframe embedding with `X-Frame-Options`, Content Security Policy, or mixed-content rules. Prompt Studio cannot reliably detect those cross-origin failures. Use **Open externally** when a page stays blank.
