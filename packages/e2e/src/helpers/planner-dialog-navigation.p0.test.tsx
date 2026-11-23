import { expect, test } from "bun:test";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { AutoBuildDialogContent } from "planner/testing";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

test.each(
  ["supervisor", "worker", "request"].flatMap((kind) => [
    { kind, succeeds: true },
    { kind, succeeds: false },
  ]),
)("Auto Build conversation navigation closes only on success: %j", async ({ kind, succeeds }) => {
  // Critical risk: a conversation opened behind the modal cannot receive input or focus.
  const keys = ["IS_REACT_ACT_ENVIRONMENT", "document", "requestAnimationFrame", "cancelAnimationFrame"] as const;
  const previous = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { nodeType: 9, defaultView: new EventTarget(), getElementById: () => null },
  });
  const frames = new Set<ReturnType<typeof setTimeout>>();
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (fn: () => void) => {
      const frame = setTimeout(() => {
        frames.delete(frame);
        fn();
      }, 0);
      frames.add(frame);
      return frame;
    },
  });
  Object.defineProperty(globalThis, "cancelAnimationFrame", { configurable: true, value: clearTimeout });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  const supervisor = { id: "supervisor", title: "Supervisor conversation", status: "in_progress" };
  const worker = { id: "worker", title: "Worker conversation", status: "in_progress" };
  const navigations: string[] = [];
  const pending = Promise.withResolvers<void>();
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <ChakraProvider value={psTheme}>
          <AutoBuildDialogContent
            enabled
            supervisor={supervisor}
            sessions={[worker]}
            running={1}
            capacity={2}
            reviewRequests={[
              {
                id: "request",
                ticketId: "ticket",
                title: "Decision",
                instructions: "Choose a path",
                requestedAt: "2026-11-23T00:00:00Z",
                requestedBy: { type: "human", id: "person", displayName: "Person" },
                request: { kind: "task" },
                state: "open",
                outcome: null,
                outcomeText: null,
                context: {
                  reason: null,
                  workspaceId: null,
                  attemptRevision: null,
                  sessionId: null,
                  relatedSessionId: null,
                },
              },
            ]}
            onStop={async () => true}
            onOpenSession={async (session) => {
              navigations.push(session.id);
              await pending.promise;
            }}
            onOpenRequestChat={async (id) => {
              navigations.push(id);
              await pending.promise;
            }}
            onClose={() => navigations.push("closed")}
            t={(_key, fallback) => fallback ?? ""}
          />
        </ChakraProvider>,
      );
    });
    if (kind === "request") {
      await act(async () => {
        tree!.root.findAll((node) => typeof node.props.onOpenRequests === "function")[0]!.props.onOpenRequests();
      });
    }
    const open = () => {
      if (kind === "request")
        return tree!.root
          .findAll((node) => typeof node.props.onOpenChat === "function")[0]!
          .props.onOpenChat("request");
      const session = kind === "supervisor" ? supervisor : worker;
      return tree!.root
        .findAll((node) => node.props.session?.id === session.id && typeof node.props.onOpen === "function")[0]!
        .props.onOpen(session);
    };
    let navigation: Promise<unknown> | undefined;
    await act(async () => {
      navigation = open();
    });
    expect(navigations).toEqual([kind]);
    await act(async () => {
      if (succeeds) {
        pending.resolve();
        await navigation;
      } else {
        const outcome = navigation!.catch((error: Error) => error);
        pending.reject(new Error("Navigation refused"));
        expect(await outcome).toMatchObject({ message: "Navigation refused" });
      }
    });
    expect(navigations).toEqual(succeeds ? [kind, "closed"] : [kind]);
  } finally {
    pending.resolve();
    await act(async () => tree?.unmount());
    for (const frame of frames) clearTimeout(frame);
    for (const key of keys) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
