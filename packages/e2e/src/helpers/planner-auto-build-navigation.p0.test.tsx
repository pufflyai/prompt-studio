import { expect, test } from "bun:test";
import { createWebviewClient } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { AutoBuildControl, type PlanClient } from "planner/testing";
import { createElement } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

const text = (node: ReactTestInstance) =>
  node
    .findAll(() => true)
    .flatMap((item) => item.children.filter((child) => typeof child === "string"))
    .join("");
const click = (tree: ReactTestRenderer, label: string) => {
  const button = tree.root.findAll(
    (node) =>
      typeof node.type === "string" &&
      (node.type === "button" || node.props.role === "button") &&
      text(node).includes(label),
  )[0];
  expect(button).toBeDefined();
  button!.props.onClick({ defaultPrevented: false, preventDefault() {} });
};

for (const entry of ["Supervisor conversation", "Worker conversation", "Request conversation", "Failed request"])
  test(`Auto Build hands off ${entry} only after navigation succeeds`, async () => {
    const originals = new Map(
      ["document", "window", "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
        key,
        Object.getOwnPropertyDescriptor(globalThis, key),
      ]),
    );
    const frames = new Set<ReturnType<typeof setTimeout>>();
    const navigation = Promise.withResolvers<unknown>();
    const events: string[] = [];
    const mode = {
      revision: "run",
      enabled: true,
      state: "running",
      prompt: "Build",
      blockOnReview: false,
      requireMergedDependencies: true,
      eligible: { conjunction: "and", rules: [] },
      supervisor: { id: "supervisor", title: "Supervisor conversation", status: "in_progress" },
      sessions: [{ id: "worker", title: "Worker conversation", status: "in_progress" }],
      capacity: { running: 1, limit: 2 },
      requestErrors: [],
      reviewRequests: [
        {
          id: "request",
          ticketId: "ticket",
          title: "Request conversation",
          instructions: "Review this work",
          request: { kind: "task" },
          requestedAt: "2026-11-22T00:00:00Z",
          requestedBy: { type: "agent", id: "agent" },
          context: { reason: null, workspaceId: null, attemptRevision: null, sessionId: null, relatedSessionId: null },
          state: "open",
          outcome: null,
          outcomeText: null,
        },
      ],
    };
    const transport = createRetainedExtensionQueryFixture({
      extensionId: "pstdio.planner",
      execute: async (command) => {
        if (command.commandId.endsWith(".review-requests.open")) {
          events.push("request");
          return navigation.promise;
        }
        return mode;
      },
      call: async (method, input) => {
        if (method === "navigation.open") {
          events.push((input as { target: { resource: { id: string } } }).target.resource.id);
          return navigation.promise;
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
        tree = create(
          <ChakraProvider value={psTheme}>{createElement(AutoBuildControl, controlProps)}</ChakraProvider>,
          { createNodeMock: () => ({}) },
        );
      });
      const request = entry.includes("request") || entry.includes("Request");
      if (request) await act(async () => click(tree!, "Needs attention"));
      await act(async () => click(tree!, request ? "Open session" : entry));
      const sessionId = entry.startsWith("Supervisor") ? "supervisor" : "worker";
      expect(events).toEqual([request ? "request" : sessionId]);
      await act(async () => {
        if (entry === "Failed request") navigation.reject(new Error("Conversation unavailable"));
        else navigation.resolve({});
      });
      if (entry === "Failed request") {
        expect(events).not.toContain("closed");
        expect(text(tree!.root)).toContain("Conversation unavailable");
      } else expect(events.at(-1)).toBe("closed");
    } finally {
      navigation.resolve({});
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
