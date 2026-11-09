import { expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createScopedQueryClient } from "../scoped-query";
import { useScopedQuery } from "./scoped-query";
import { useWebviewVisibility } from "./webview-visibility";

test("retained webviews stop optional query reads while hidden, reuse accepted data and catch up once on return", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousAct = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const document = Object.assign(new EventTarget(), { hidden: false });
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  const root = createScopedQueryClient({ runtimeId: "visible", extensionId: "example" });
  let reads = 0;
  let latest = "Accepted";
  const descriptor = {
    id: "preview",
    read: async () => {
      reads++;
      return latest;
    },
  };
  const query = root.query(descriptor);
  let renderer: ReactTestRenderer | undefined;
  const Probe = () => {
    const visible = useWebviewVisibility();
    const snapshot = useScopedQuery(root.query(descriptor), visible);
    return <span>{snapshot.data}</span>;
  };
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
  try {
    await act(async () => {
      renderer = create(<Probe />);
      await settle();
    });
    expect(reads).toBe(1);
    await act(async () => {
      document.hidden = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(query.inspect().automaticObservers).toBe(0);
    latest = "Changed while away";
    for (let event = 0; event < 50; event++) query.invalidate();
    await settle();
    expect(reads).toBe(1);
    expect(query.getSnapshot().data).toBe("Accepted");
    await act(async () => {
      document.hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
      await settle();
    });
    expect(query.getSnapshot().data).toBe("Changed while away");
    expect(reads).toBe(2);
    await act(async () => {
      document.hidden = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    root.setAuthority({ accountId: "another-account" });
    expect(query.getSnapshot().data).toBeUndefined();
    await act(async () => {
      document.hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
      await settle();
    });
    expect(reads).toBe(3);
    await act(async () => renderer?.unmount());
    renderer = undefined;
    expect(root.inspect().active).toBe(0);
  } finally {
    await act(async () => renderer?.unmount());
    root.dispose();
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
    environment.IS_REACT_ACT_ENVIRONMENT = previousAct;
  }
});
