import { createWebviewClient, defineExtensionView, type WebviewHostProps } from "@pstdio/sdk/extensions";

export default defineExtensionView<WebviewHostProps>({
  render({ mount, host, propsStore }) {
    const heading = document.createElement("h1");
    const renderLocation = () => {
      heading.textContent = `Alternative ${propsStore.get().pageLocation?.page.id ?? "Cloud"}`;
    };
    renderLocation();
    const unsubscribe = propsStore.subscribe(renderLocation);
    const status = document.createElement("p");
    mount.append(heading, status);
    void createWebviewClient(host)
      .account.status()
      .then((account) => {
        status.textContent = account.login ? "Cloud signed in" : "Cloud signed out";
      });
    return () => {
      unsubscribe();
      mount.replaceChildren();
    };
  },
});
