import { afterEach, beforeEach, expect, test } from "bun:test";
import { createWebviewClient } from "@pstdio/sdk/extensions";
import { type PlanClient, useGraphTicketPreviews } from "planner/testing";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
beforeEach(() =>
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: Object.assign(new EventTarget(), { hidden: false }),
  }),
);
afterEach(() => {
  if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
  else Reflect.deleteProperty(globalThis, "document");
});
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("visible preview batches bound reads and retire a manual retry when the viewport changes", async () => {
  const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const prior = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const reads: { ids: string[]; project: string; signal: AbortSignal }[] = [];
  const held = Promise.withResolvers<unknown>();
  let hold = false;
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.planner",
    execute: async (command, signal, project) => {
      const ids = command.params?.ticketIds as string[];
      reads.push({ ids, project, signal });
      if (hold) return held.promise;
      return ids.map((id) => ({
        id,
        attributes: { workspace: project, linkedResourceItems: [{ id: project, label: project }] },
      }));
    },
  });
  const frame = transport.frame("a"),
    client = createWebviewClient(frame.host) as PlanClient;
  let latest: ReturnType<typeof useGraphTicketPreviews>;
  const source = new Map(
    Array.from({ length: 102 }, (_, i) => [String(i), { id: String(i), title: "Current title", attributes: {} }]),
  );
  const Probe = ({ ids }: { ids: string[] }) => {
    latest = useGraphTicketPreviews({ client, rows: source }, ids);
    return null;
  };
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(<Probe ids={[...source.keys()].slice(0, 101)} />);
    });
    expect(reads.map(({ ids }) => ids.length)).toEqual([100, 1]);
    expect(latest!.rows.get("0")?.title).toBe("Current title");
    expect(latest!.rows.get("0")?.attributes.workspace).toBe("a");
    const before = reads.length;
    hold = true;
    const oldRetry = latest!.retry;
    await act(async () => {
      oldRetry();
      await turn();
    });
    const retries = reads.slice(before);
    expect(retries).toHaveLength(2);
    hold = false;
    await act(async () => {
      tree!.update(<Probe ids={["101"]} />);
      await turn();
    });
    expect(retries.every(({ signal }) => signal.aborted)).toBe(true);
    const after = reads.length;
    oldRetry();
    expect(reads).toHaveLength(after);
    await act(async () => {
      held.resolve([{ id: "101", attributes: { workspace: "stale" } }]);
      await turn();
    });
    expect(latest!.rows.get("101")?.attributes.workspace).toBe("a");
    await act(async () => {
      frame.project("b");
    });
    expect(latest!.rows.get("101")?.attributes.workspace).toBe("b");
  } finally {
    held.resolve([]);
    await act(async () => tree?.unmount());
    client.queries.dispose();
    transport.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = prior;
  }
});
