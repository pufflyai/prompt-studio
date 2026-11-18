import { defineExtensionView } from "@pstdio/sdk/extensions";
export default defineExtensionView({
  render({ mount, host }) {
    const heading = document.createElement("h1");
    heading.textContent = "Download contract";
    const button = document.createElement("button");
    button.textContent = "Download HTML";
    button.onclick = () =>
      void host.call("files.download", {
        name: "résumé.html",
        mimeType: "text/html",
        data: new TextEncoder().encode("<!doctype html><h1>Résumé</h1>"),
      });
    mount.append(heading, button);
    return () => mount.replaceChildren();
  },
});
