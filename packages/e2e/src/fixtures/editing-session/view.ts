import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { editingChanged } from "./events";
import type { editingCommands } from "./extension";

export default defineExtensionView({
  render({ mount, host }) {
    const client = createWebviewClient<typeof editingCommands>(host);
    let active = true;
    let dispose = () => {};
    const start = async () => {
      const read = () => client.commands["editing.read"]();
      const session = await client.editing.open({
        key: "document",
        initial: await read(),
        save: { commandId: `${host.extensionId}.command.editing.save` },
      });
      if (!active) {
        await session.close();
        return;
      }
      mount.innerHTML =
        '<label>Title <input aria-label="Title"></label><output aria-label="Position"></output><button>Preview move</button><button>Commit move</button><button>Cancel move</button><p role="alert"></p>';
      const input = mount.querySelector("input")!;
      const output = mount.querySelector("output")!;
      const reportError = (error: unknown) => {
        mount.querySelector('[role="alert"]')!.textContent = String(error);
      };
      const render = () => {
        const state = session.getSnapshot().value;
        input.value = state.title;
        output.textContent = `${state.position.x}, ${state.position.y}`;
      };
      render();
      const unsubscribe = session.subscribe(render);
      const events = client.events.subscribe(editingChanged, () => {
        void session.refresh(read).catch(reportError);
      });
      input.oninput = () => {
        void session.commit([{ path: ["title"], value: input.value }]).catch(reportError);
      };
      const [preview, commit, cancel] = mount.querySelectorAll("button");
      preview.onclick = () => {
        void session
          .preview([
            { path: ["position", "x"], value: 12 },
            { path: ["position", "y"], value: 24 },
          ])
          .catch(reportError);
      };
      commit.onclick = () => {
        void session.commit().catch(reportError);
      };
      cancel.onclick = () => {
        void session.cancel().catch(reportError);
      };
      dispose = () => {
        unsubscribe();
        events();
        void session.close();
      };
    };
    void start().catch((error) => {
      mount.textContent = String(error);
    });
    return () => {
      active = false;
      dispose();
    };
  },
});
