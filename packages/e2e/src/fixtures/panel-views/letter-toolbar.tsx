import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  type WebviewHostProps,
} from "@pstdio/sdk/extensions";
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { headerContext } from "./panel-views";

const LetterToolbar = ({ context }: { context: ExtensionViewRenderContext<WebviewHostProps> }) => {
  const props = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get);
  const [client] = useState(() => createWebviewClient<{ "header-context": typeof headerContext }>(context.host));
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("");
  return (
    <div>
      <label>
        Letter search
        <input value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <button
        type="button"
        onClick={() => void client.commands["header-context"]().then((id) => setResult(String(id)))}
      >
        Read header context
      </button>
      <span>Header for {props.resource?.id ?? "landing"}</span>
      <output>{result ? `Command for ${result}` : ""}</output>
    </div>
  );
};
export default defineExtensionView<WebviewHostProps>({
  render(context) {
    const root = createRoot(context.mount);
    root.render(<LetterToolbar context={context} />);
    return () => root.unmount();
  },
});
