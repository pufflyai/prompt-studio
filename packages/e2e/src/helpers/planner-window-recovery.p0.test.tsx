import { afterEach, beforeEach, expect, test } from "bun:test";
import { createWebviewClient } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { type PlanClient, RelationshipWindow, RequestWindowControls, usePlanActions } from "planner/testing";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

const originals = ["document", "window", "IS_REACT_ACT_ENVIRONMENT"].map(
  (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
);
beforeEach(() => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      hidden: false,
      nodeType: 9,
      defaultView: globalThis,
      getElementById: () => null,
    }),
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
});
afterEach(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test("an unloaded dependency exposes a failed selection and can retry the same ticket", async () => {
  let failed = true;
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.planner",
    execute: async () => {
      if (failed) throw new Error("Selection unavailable");
      return { sections: [{ rows: [{ id: "outside", dependsOn: [], blocks: [] }] }] };
    },
  });
  const frame = transport.frame(),
    client = createWebviewClient(frame.host) as PlanClient;
  let latest: ReturnType<typeof usePlanActions>;
  const Probe = () => {
    latest = usePlanActions({
      host: frame.host as Parameters<typeof usePlanActions>[0]["host"],
      client,
      plan: undefined,
      sections: [],
      tracks: { list: [], indexOf: () => 0 },
      toggle: () => {},
      onReview: () => {},
    });
    return null;
  };
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(<Probe />);
    });
    await act(async () => latest.setSelectedId("outside"));
    expect(latest!.selectionError?.message).toBe("Selection unavailable");
    failed = false;
    await act(async () => latest.retrySelection());
    expect(latest!.selected?.id).toBe("outside");
    expect(latest!.selectionError).toBeUndefined();
  } finally {
    await act(async () => tree?.unmount());
    client.queries.dispose();
    transport.dispose();
  }
});

test("request paging keeps Previous after answering the only request on a later page", async () => {
  const moves: number[] = [];
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <ChakraProvider value={psTheme}>
          <RequestWindowControls
            offset={25}
            move={(offset) => moves.push(offset)}
            result={{ total: 25, hasNext: false }}
          />
        </ChakraProvider>,
      );
    });
    const previous = tree!.root.findAllByType("button").find((button) => button.children.includes("Previous"));
    expect(previous).toBeDefined();
    await act(async () => previous!.props.onClick());
    expect(moves).toEqual([0]);
  } finally {
    await act(async () => tree?.unmount());
  }
});

test("relationship paging returns from an emptied later page", async () => {
  const offsets: number[] = [];
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.planner",
    execute: async (command) => {
      const offset = Number(command.params?.offset);
      offsets.push(offset);
      return { links: [], total: offset ? 25 : 26, hasNext: !offset };
    },
  });
  const frame = transport.frame(),
    client = createWebviewClient(frame.host) as PlanClient;
  let tree: ReactTestRenderer | undefined;
  const button = (label: string) =>
    tree!.root.findAllByType("button").find((button) => button.children.includes(label));
  try {
    await act(async () => {
      tree = create(
        <ChakraProvider value={psTheme}>
          <RelationshipWindow client={client} ticketId="one" direction="dependsOn" onSelect={() => {}} />
        </ChakraProvider>,
      );
    });
    await act(async () => button("Next")!.props.onClick());
    expect(button("Previous")).toBeDefined();
    await act(async () => button("Previous")!.props.onClick());
    expect(offsets.slice(0, 2)).toEqual([0, 25]);
    expect(button("Next")).toBeDefined();
  } finally {
    await act(async () => tree?.unmount());
    client.queries.dispose();
    transport.dispose();
  }
});
