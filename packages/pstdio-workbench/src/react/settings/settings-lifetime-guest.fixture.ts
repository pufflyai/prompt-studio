import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";

export default defineExtensionView({
  render({ mount, host }) {
    const client = createWebviewClient(host);
    const output = document.createElement("output");
    mount.append(output);
    let received = 0;
    const started = Promise.all([
      client.performance.retain(),
      client.performance.subscribe(() => {
        output.textContent = `Received ${++received}`;
      }),
    ]);
    void started.then(() => {
      output.textContent = "Received 0";
    });
    // Deliberately omit explicit guest disposal. Removing its browsing context
    // must release both host-owned capabilities even if no guest code can run.
  },
});
