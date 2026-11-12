import { defineExtensionView } from "@pstdio/sdk/extensions";
export default defineExtensionView({
  render({ mount, propsStore }) {
    const section = document.createElement("output");
    section.setAttribute("aria-label", "Current section");
    mount.append(section);
    const update = () => {
      section.textContent = propsStore.get().pageLocation?.section?.anchors.at(-1)?.heading ?? "Whole document";
    };
    update();
    const unsubscribe = propsStore.subscribe(update);
    return () => {
      unsubscribe();
      mount.replaceChildren();
    };
  },
});
