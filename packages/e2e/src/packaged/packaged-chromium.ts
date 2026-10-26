import type { LaunchOptions } from "@playwright/test";

// `pst extensions install-browser` provisions full Chromium without the separate headless shell
// (`--no-shell`), and `pst extensions test` launches that browser. Plain `chromium.launch()` with
// `headless` picks the headless shell instead, which a clean machine does not have. The `chromium`
// channel runs the provisioned full Chromium headless, so packaged tests need no second download.
export const PROVISIONED_CHROMIUM: LaunchOptions = {
  channel: process.env.PSTDIO_QUALIFY_BROWSER_CHANNEL ?? "chromium",
  args: ["--enable-automation"],
};
