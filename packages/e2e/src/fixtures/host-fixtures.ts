import { resolve } from "node:path";
export const hostFixtureSources = {
  harness: resolve(import.meta.dirname, "../../../workbench-fixture"),
  webview: resolve(import.meta.dirname, "../../../workbench-fixture/fixtures/webview-host"),
  panels: resolve(import.meta.dirname, "panel-views"),
  automation: resolve(import.meta.dirname, "automation"),
  mode: resolve(import.meta.dirname, "mode"),
  menu: resolve(import.meta.dirname, "menu"),
  document: resolve(import.meta.dirname, "document"),
  settings: resolve(import.meta.dirname, "settings"),
};
