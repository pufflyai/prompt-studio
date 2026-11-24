import {
  createWebviewClient,
  defineExtensionView,
  type ResourceRef,
  registerWebviewResourceAction,
} from "@pstdio/sdk/extensions";

export default defineExtensionView<{ resource?: ResourceRef }>({
  render({ mount, host, propsStore }) {
    const client = createWebviewClient(host);
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = "Ready";
    mount.append(status);
    const resource = propsStore.get().resource;
    if (!resource) throw new Error("Export document is missing");
    const action = registerWebviewResourceAction(
      host,
      { resource, label: "Export SVG", icon: "Download" },
      async (signal) => {
        signal.throwIfAborted();
        status.textContent = "Saving";
        try {
          const result = await client.files.save({
            name: "great-wave.svg",
            mimeType: "image/svg+xml",
            data: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><text>Våg</text></svg>'),
          });
          if (!signal.aborted) status.textContent = result.status;
        } catch (error) {
          if (!signal.aborted) status.textContent = String(error);
          throw error;
        }
      },
    );
    void action.ready.catch((error) => {
      status.textContent = String(error);
    });
    return () => {
      void action.dispose();
      mount.replaceChildren();
    };
  },
});
