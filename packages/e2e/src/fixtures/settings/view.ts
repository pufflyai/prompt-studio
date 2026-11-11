import { defineExtensionView } from "@pstdio/sdk/extensions";
export default defineExtensionView({
  render({ mount, host }) {
    const input = document.createElement("input");
    input.type = "number";
    input.setAttribute("aria-label", "Value");
    input.disabled = true;
    const save = document.createElement("button");
    save.textContent = "Save";
    save.disabled = true;
    const status = document.createElement("output");
    status.setAttribute("aria-label", "Save status");
    void host.call("extension.settings.all", {}).then((values) => {
      input.value = String(values.value);
      input.disabled = false;
      save.disabled = false;
    });
    save.onclick = () => {
      void host.call("extension.settings.set", { key: "value", value: Number(input.value) }).then(() => {
        status.textContent = "Saved";
      });
    };
    mount.append(input, save, status);
    return () => mount.replaceChildren();
  },
});
