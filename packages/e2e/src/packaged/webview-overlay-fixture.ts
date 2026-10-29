import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

/** Exercise the published client and compiled bridge without sharing DOM across the sandbox. */
export const writeWebviewOverlayFixture = (root: string) => {
  const source = join(root, "overlay-probe");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "overlay-probe",
      publisher: "test",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      dependencies: { "@pstdio/sdk": `file:${resolve(import.meta.dirname, "../../../sdk/.publish")}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `
import { defineExtension, defineMode, definePage, defineView, packageAsset } from "@pstdio/sdk/extensions";
const tools = defineView({ id: "tools", title: "Overlay tools", body: {
  kind: "webview", entry: packageAsset("./tools.ts", import.meta.url), capabilities: ["overlays"],
} });
const main = defineView({ id: "main", title: "Overlay canvas", body: {
  kind: "webview", entry: packageAsset("./main.ts", import.meta.url),
} });
const mode = defineMode({ id: "overlay", label: "Overlay", icon: "Image", regions: ["main"],
  chrome: { activity: tools.ref, sidenav: false } });
const page = definePage({ id: "overlay", title: "Overlay", path: "overlay", mode: mode.ref,
  main: { kind: "view", view: main.ref, cardinality: "one", presentation: "page" }, slots: [] });
export default defineExtension({ views: [tools, main], modes: [mode], pages: [page] });
`,
  );
  writeFileSync(
    join(source, "main.ts"),
    `
import { defineExtensionView } from "@pstdio/sdk/extensions";
export default defineExtensionView({ render({ mount }) {
  const button = document.createElement("button"); button.textContent = "Outside overlay";
  mount.append(button); return () => button.remove();
} });
`,
  );
  writeFileSync(
    join(source, "tools.ts"),
    `
import { createWebviewClient, defineExtensionView, observeWebviewOverlayAnchor } from "@pstdio/sdk/extensions";
export default defineExtensionView({ render({ mount, host }) {
  const { overlays } = createWebviewClient(host);
  const status = document.createElement("output"); status.setAttribute("aria-label", "Overlay result");
  let stop = () => {};
  const show = async (button, content) => {
    stop();
    const result = overlays.show({ id: button.id, anchor: button.getBoundingClientRect(), placement: "right", content });
    stop = observeWebviewOverlayAnchor(button, (anchor) => void overlays.move(button.id, anchor),
      () => void overlays.close(button.id));
    const value = await result; stop(); status.textContent = value.actionId ?? "dismissed";
  };
  const add = (id, text, content) => {
    const button = document.createElement("button"); button.id = id; button.textContent = text;
    button.addEventListener("click", () => void show(button, content)); mount.append(button); return button;
  };
  add("tip", "Tip", { kind: "tooltip", text: "Tooltip extends beyond the narrow source frame" });
  add("menu", "Menu", { kind: "menu", label: "Overlay actions", items: [
    { id: "apply", label: "Apply layer" }, { id: "disabled", label: "Disabled layer", disabled: true },
  ] });
  add("popover", "Info", { kind: "popover", title: "Layer information", text: "Host popover content",
    actions: [{ id: "confirm", label: "Confirm layer" }] });
  mount.append(status);
  return () => { stop(); mount.replaceChildren(); };
} });
`,
  );
  return source;
};
