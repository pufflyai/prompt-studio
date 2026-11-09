import { afterEach, expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { Suspense, useSyncExternalStore } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
import { registerWorkbenchExtensionChatRenderers } from "../../../extensions/contributions/chat-renderer-contributions";
import { emptyWorkbenchExtensionMetadata } from "../../../extensions/contributions/extension-contributions";
import { type NativeChatPresentation, useNativeChatPresentation } from "./use-native-chat-presentation";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = environment.IS_REACT_ACT_ENVIRONMENT;
let tree: ReactTestRenderer | undefined;
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
  for (const close of cleanups.splice(0)) await close();
  environment.IS_REACT_ACT_ENVIRONMENT = previous;
});
const fixture = (maxInactive: number) => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const queries = createScopedQueryClient({ runtimeId: "runtime", extensionId: "host" }, { maxInactive });
  const core = createWorkbench({ queries });
  const reads: string[] = [];
  const id = "acme.chat.view.chat";
  const registration = registerWorkbenchExtensionChatRenderers({
    workbench: core,
    queries,
    projectId: "project",
    metadata: {
      ...emptyWorkbenchExtensionMetadata,
      views: [
        {
          id,
          localId: "chat",
          extensionId: "acme.chat",
          title: "Chat",
          body: { kind: "chat", queryHandlerId: "query", actionHandlerId: "action", draftKey: "draft" },
        },
      ],
    },
    executeCommand: async (_id, input) => {
      reads.push(input.resource!.id);
      return { messages: [] };
    },
  });
  const render = (resource: string) => {
    const element = getWorkbenchRenderers(core)
      .getRenderer(id)!
      .render({
        workbench: core,
        instance: { instanceId: resource, panelId: id, closable: true, resource: { type: "session", id: resource } },
        panel: { id, title: "Chat", rendererId: id, region: "main" },
        refresh() {},
      }) as {
      props: Omit<NativeChatPresentation, "key"> & {
        conversationKey: string;
        resolve(): NativeChatPresentation | undefined;
        observe(session: NativeChatPresentation["session"]): () => void;
      };
    };
    return {
      reactKey: (element as unknown as { key: string }).key,
      initial: { ...element.props, key: element.props.conversationKey },
      resolve: element.props.resolve,
      observe: element.props.observe,
    };
  };
  cleanups.push(async () => {
    registration.dispose();
    await core.dispose();
    queries.dispose();
  });
  return { queries, render, reads };
};
const Probe = (props: Parameters<typeof useNativeChatPresentation>[0]) => {
  const { session } = useNativeChatPresentation(props);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return <span>{snapshot.loading ? "loading" : "ready"}</span>;
};

test("multiple chats acquire their current common owners at commit with a zero inactive budget", async () => {
  const f = fixture(0);
  const keys: string[][] = [];
  const Parent = () => {
    const first = f.render("one"),
      second = f.render("two");
    keys.push([first.reactKey, second.reactKey]);
    return (
      <>
        <Probe {...first} />
        <Probe {...second} />
      </>
    );
  };
  await act(async () => {
    tree = create(<Parent />);
  });
  expect(f.reads.sort()).toEqual(["one", "two"]);
  expect(f.queries.inspect().active).toBe(2);
  await act(async () => tree!.update(<Parent />));
  expect(f.reads.sort()).toEqual(["one", "two"]);
  expect(keys[1]).toEqual(keys[0]);
  expect(f.queries.inspect().active).toBe(2);
});

test("Suspense-abandoned chat renders never retain observation or optional reads", async () => {
  const f = fixture(1);
  const never = new Promise<never>(() => {});
  const Abandoned = () => {
    f.render("abandoned");
    throw never;
  };
  await act(async () => {
    tree = create(
      <Suspense fallback={null}>
        <Abandoned />
      </Suspense>,
    );
  });
  await act(async () => tree!.update(<span>Other page</span>));
  await act(async () => tree!.unmount());
  tree = undefined;
  expect(f.queries.inspect().active).toBe(0);
  expect(f.reads).toEqual([]);
});

test("abandoned placements cannot evict a mounted chat's presentation identity", async () => {
  const f = fixture(128);
  const Parent = () => <Probe {...f.render("active")} />;
  await act(async () => {
    tree = create(<Parent />);
  });
  for (let index = 0; index < 130; index++) f.render(`abandoned-${index}`);
  await act(async () => tree!.update(<Parent />));
  expect(f.reads).toEqual(["active"]);
  expect(f.queries.inspect().active).toBe(1);
});

test("a warm chat evicted between render and commit rebinds and reloads once", async () => {
  const f = fixture(1);
  await act(async () => {
    tree = create(<Probe {...f.render("warm")} />);
  });
  await act(async () => tree!.unmount());
  tree = undefined;
  const Parent = () => {
    const warm = f.render("warm");
    f.queries.query({ id: "other one", read: () => null });
    f.queries.query({ id: "other two", read: () => null });
    return <Probe {...warm} />;
  };
  await act(async () => {
    tree = create(<Parent />);
  });
  expect(f.reads).toEqual(["warm", "warm"]);
  expect(f.queries.inspect().active).toBe(1);
});
