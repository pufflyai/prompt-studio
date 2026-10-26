import type { LaunchOptions } from "@playwright/test";

// `pst extensions install-browser` provisions full Chromium without the separate headless shell
// (`--no-shell`), and `pst extensions test` launches that browser. Plain `chromium.launch()` with
// `headless` picks the headless shell instead, which a clean machine does not have. The `chromium`
// channel runs the provisioned full Chromium headless, so packaged tests need no second download.
export const PROVISIONED_CHROMIUM: LaunchOptions = { channel: "chromium" };

// Playwright supplies x64 Chromium on Windows ARM. These dashboard functional cases use
// native Edge until an ARM Chromium artifact is available. See ADR 0111.
export const PACKAGED_DASHBOARD_BROWSER: LaunchOptions =
  process.platform === "win32" && process.arch === "arm64" ? { channel: "msedge" } : PROVISIONED_CHROMIUM;
