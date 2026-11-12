import { defineExtensionView } from "@pstdio/sdk/extensions";
export default defineExtensionView({
  render({ mount }) {
    const text = document.createElement("span");
    text.textContent = "Mode context";
    mount.append(text);
    return () => mount.replaceChildren();
  },
});
