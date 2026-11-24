import { expect, test } from "bun:test";
import { createWebviewClient } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { AutoBuildControl, type PlanClient } from "planner/testing";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

test("the production Auto Build control preserves the session navigation promise before dismissing its dialog", async () => {
  const originals = new Map(
    ["document", "window", "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const frames = new Set<ReturnType<typeof setTimeout>>();
  const navigation = Promise.withResolvers<void>();
  const events: string[] = [];
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.planner",
    execute: async () => ({
      requestPage: { offset: 0, total: 26, hasNext: true },
      revision: "run",
      enabled: true,
      state: "running",
      prompt: "Build",
      blockOnReview: false,
      requireMergedDependencies: true,
      eligible: { conjunction: "and", rules: [] },
      supervisor: { id: "supervisor", title: "Supervisor conversation", status: "in_progress" },
      sessions: [],
      capacity: { running: 0, limit: 2 },
      reviewRequests: [],
      requestErrors: [],
    }),
    call: async (method, input) => {
      if (method === "navigation.open") {
        expect((input as { target: { resource: { id: string } } }).target.resource.id).toBe("supervisor");
        events.push("opened");
        await navigation.promise;
      }
    },
  });
  const frame = transport.frame();
  const client = createWebviewClient(frame.host) as PlanClient;
  let tree: ReactTestRenderer | undefined;
  try {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
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
    Object.defineProperty(globalThis, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        const frame = setTimeout(() => {
          frames.delete(frame);
          callback(performance.now());
        }, 0);
        frames.add(frame);
        return frame;
      },
    });
    Object.defineProperty(globalThis, "cancelAnimationFrame", {
      configurable: true,
      value: (frame: ReturnType<typeof setTimeout>) => {
        frames.delete(frame);
        clearTimeout(frame);
      },
    });
    const controlProps = {
      host: frame.host as Parameters<typeof AutoBuildControl>[0]["host"],
      client,
      t: (_key: string, fallback?: string) => fallback ?? "",
      onClose: () => {
        events.push("closed");
      },
    };
    await act(async () => {
      tree = create(<ChakraProvider value={psTheme}>{createElement(AutoBuildControl, controlProps)}</ChakraProvider>);
    });
    await act(async () =>
      tree!.root
        .findAllByType("button")
        .find((node) => node.props.children?.[1] === "Needs attention")!
        .props.onClick(),
    );
    expect(tree!.root.findAllByType("button").some((node) => node.props.children === "Next")).toBe(true);
    await act(async () =>
      tree!.root
        .findAllByType("button")
        .find((node) => node.props.children === "Back")!
        .props.onClick(),
    );
    await act(async () => {
      const row = tree!.root
        .findAllByProps({ role: "button", id: "supervisor" })
        .find((node) => typeof node.type === "string");
      expect(row).toBeDefined();
      row!.props.onClick({ defaultPrevented: false, preventDefault() {} });
    });
    expect(events).toEqual(["opened"]);
    await act(async () => navigation.resolve());
    expect(events).toEqual(["opened", "closed"]);
  } finally {
    navigation.resolve();
    await act(async () => tree?.unmount());
    for (const frame of frames) clearTimeout(frame);
    client.queries.dispose();
    transport.dispose();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
