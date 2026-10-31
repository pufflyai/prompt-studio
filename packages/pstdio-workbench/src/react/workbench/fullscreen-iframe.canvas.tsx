import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ExtensionFrame } from "pstdio-extensions/bridge/host";
import runtimeScript from "pstdio-extensions/bridge/webview-runtime.bundle.js?raw";
import { renderInlineExtensionRuntimeHtml } from "pstdio-extensions/bridge/webview-runtime-html";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createFullscreenWorkbench } from "./fullscreen.fixture";

const runtimeUrl = URL.createObjectURL(
  new Blob([renderInlineExtensionRuntimeHtml(runtimeScript)], { type: "text/html" }),
);
const moduleSource = `export default { mount(root) {
  const input = document.createElement('input'); input.setAttribute('aria-label', 'Guest draft'); root.append(input);
  const button = document.createElement('button'); button.textContent = 'Open nested dialog'; root.append(button);
  const dialog = document.createElement('dialog'); dialog.textContent = 'Guest dialog'; root.append(dialog);
  button.onclick = () => {
    dialog.showModal();
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); dialog.close(); } }, { once: true });
  };
  return () => root.replaceChildren();
} };`;
const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource)}`;
const { w } = createFullscreenWorkbench("attached", true, {
  renderEditor: (name) =>
    name === "Editor" || name === "Session" ? (
      <ExtensionFrame
        title={`${name} extension`}
        theme="dark"
        props={{}}
        view={{ id: name, label: name, extensionId: "fullscreen", webview: { runtimeUrl, moduleUrl, styles: [] } }}
      />
    ) : null,
});
const meta = {
  title: "pstdio-workbench/Reference/Core API/Main fullscreen iframe",
  component: WorkbenchStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const GuestKeyboard: Story = {
  id: "pstdio-workbench-reference-core-api-main-fullscreen-iframe--guest-keyboard",
  args: { workbench: w },
};
