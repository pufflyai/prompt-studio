import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
export default defineExtensionView({
  render({ mount, host, propsStore }) {
    const heading = document.createElement("h1");
    heading.textContent = "Host contract";
    const output = document.createElement("output");
    output.setAttribute("aria-label", "Counter");
    const button = document.createElement("button");
    button.textContent = "Increment";
    const run = async (name: string) => {
      const response = await host.call("commands.execute", {
        commandId: `test.webview-host.command.${name}`,
        params: {},
      });
      if (response.outcome.status !== "success") throw new Error(String(response.outcome.reason));
      output.textContent = String((response.outcome.value as { counter: number }).counter);
    };
    button.onclick = () => void run("bump");
    mount.append(heading, output, button);
    let projectId = propsStore.get().projectId;
    const unsubscribe = propsStore.subscribe((props) => {
      if (props.projectId !== projectId) {
        projectId = props.projectId;
        void run("read");
      }
    });
    const unsubscribeEvents = createWebviewClient<Record<never, never>>(host).events.subscribe(
      { kind: "event", id: "changed" },
      () => void run("read"),
    );
    void run("read");
    return () => {
      unsubscribe();
      unsubscribeEvents();
      mount.replaceChildren();
    };
  },
});
