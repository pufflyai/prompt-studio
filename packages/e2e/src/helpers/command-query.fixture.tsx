import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createRoot } from "react-dom/client";

const listeners = new Set<(payload: unknown) => void>();
const host: GuestHost = {
  extensionId: "query-fixture",
  call: async () => {
    throw new Error("This fixture only subscribes to host events");
  },
  onEvent: (_scope, listener) => {
    listeners.add(listener);
    document.querySelector("#subscriptions")!.textContent = String(listeners.size);
    return () => {
      listeners.delete(listener);
      document.querySelector("#subscriptions")!.textContent = String(listeners.size);
    };
  },
};
const client = createWebviewClient<Record<string, never>>(host);
let calls = 0;
let revision = 1;
let holdNext = false;
let release = () => {};
const ReadQuery = () => {
  const [, setTick] = useState(0);
  const query = useCommandQuery({
    queryKey: ["fixture"],
    command: async () => {
      document.querySelector("#calls")!.textContent = String(++calls);
      const snapshot = revision;
      if (holdNext) {
        holdNext = false;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return snapshot;
    },
    staleTime: Infinity,
    refreshOn: { client, events: ["query-fixture.changed", "query-fixture.saved"] },
  });
  return (
    <div>
      <button onClick={() => setTick((tick) => tick + 1)}>Rerender</button>
      <output id="result">{query.data}</output>
    </div>
  );
};
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const App = () => {
  const [mounted, setMounted] = useState(true);
  return (
    <QueryClientProvider client={queryClient}>
      <button onClick={() => setMounted(false)}>Unmount</button>
      {mounted ? <ReadQuery /> : null}
    </QueryClientProvider>
  );
};
for (const [id, payload] of [
  ["unrelated", { type: "changed", id: "query-fixture.other" }],
  ["matching", { type: "changed", id: "query-fixture.changed" }],
  ["reset", { type: "reset" }],
] as const) {
  document.querySelector(`#${id}`)!.addEventListener("click", () => {
    if (id !== "unrelated") revision++;
    for (const listener of listeners) listener(payload);
  });
}
document.querySelector("#hold")!.addEventListener("click", () => {
  holdNext = true;
  for (const listener of listeners) listener({ type: "changed", id: "query-fixture.changed" });
});
document.querySelector("#release")!.addEventListener("click", () => release());
createRoot(document.querySelector("#app")!).render(<App />);
