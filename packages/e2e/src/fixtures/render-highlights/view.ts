import { defineExtensionView } from "@pstdio/sdk/extensions";

export default defineExtensionView({
  render({ mount, host }) {
    const toggle = document.createElement("button");
    toggle.textContent = "Highlight workbench renders";
    toggle.setAttribute("aria-pressed", "false");
    toggle.onclick = async () => {
      const enabled = toggle.getAttribute("aria-pressed") !== "true";
      await host.call("performance.control", { operation: "set-render-overlay", enabled });
      toggle.setAttribute("aria-pressed", String(enabled));
    };
    mount.append(toggle);
    return () => toggle.remove();
  },
});
