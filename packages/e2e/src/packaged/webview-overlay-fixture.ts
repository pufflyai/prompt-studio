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
import { defineCommand, defineExtension, defineKeybinding, defineMode, definePage, defineView, packageAsset } from "@pstdio/sdk/extensions";
const hand = defineCommand({ id: "hand", title: "Hand tool", run() {} });
const handBinding = defineKeybinding({ id: "hand", key: "H", action: { kind: "command", target: { command: hand.ref } } });
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
export default defineExtension({ commands: [hand], keybindings: [handBinding], views: [tools, main], modes: [mode], pages: [page] });
`,
  );
  writeFileSync(
    join(source, "main.ts"),
    `
import { defineExtensionView } from "@pstdio/sdk/extensions";
export default defineExtensionView({ render({ mount }) {
  const button = document.createElement("button"); button.textContent = "Outside overlay";
  const input = document.createElement("input"); input.setAttribute("aria-label", "Draft");
  const shadow = document.createElement("div");
  shadow.attachShadow({ mode: "open" }).innerHTML = '<input aria-label="Shadow draft">';
  mount.append(button, input, shadow); return () => mount.replaceChildren();
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
    const release = observeWebviewOverlayAnchor(button, (anchor) => void overlays.move(button.id, anchor),
      () => void overlays.close(button.id));
    stop = release;
    const value = await result; release(); status.textContent = value.actionId ?? "dismissed";
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
