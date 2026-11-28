import { expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { createMemoryActivity } from "@pstdio/sdk/testing";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench } from "../../core";
import type { ResourceActivityBinding } from "../../core/registries/resources/resource-activity";
import { useResourceActivityComposer } from "./use-resource-activity-composer";

test("posting a thread reply preserves standalone and other-thread drafts", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const api = createMemoryActivity();
  const resource: ResourceRef = { projectId: "project", extensionId: "notes", type: "note", id: "document" };
  const first = await api.publish(resource, { key: "first-parent", kind: "comment", body: "First parent" });
  const second = await api.publish(resource, { key: "second-parent", kind: "comment", body: "Second parent" });
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const binding: ResourceActivityBinding = {
    capabilities: { comments: true },
    api: {
      ...api,
      publish: async (target, input) => {
        if (input.replyToId === first.id) {
          started.resolve();
          await release.promise;
        }
        return api.publish(target, input);
      },
    },
    watch: async () => {},
  };
  const drafts = new Map<string, ReturnType<typeof useResourceActivityComposer>>();
  const Draft = (props: { id: string; replyToId?: string }) => {
    drafts.set(props.id, useResourceActivityComposer(workbench, binding, resource, props));
    return null;
  };
  let root: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      root = create(
        <>
          <Draft id="comment" />
          <Draft id="first" replyToId={first.id} />
          <Draft id="second" replyToId={second.id} />
        </>,
      );
    });
    for (const [id, draft] of drafts) act(() => draft.changeDraft({ ...draft.draft, body: id, key: id }));
    expect(drafts.get("comment")!.draft.body).toBe("comment");
    expect(drafts.get("first")!.draft.body).toBe("first");
    expect(drafts.get("second")!.draft.body).toBe("second");
    let publishing: ReturnType<ReturnType<typeof useResourceActivityComposer>["publish"]>;
    await act(async () => {
      publishing = drafts.get("first")!.publish();
      await started.promise;
    });
    expect(drafts.get("first")!.busy).toBe(true);
    expect(drafts.get("comment")!.busy).toBe(false);
    expect(drafts.get("second")!.busy).toBe(false);
    await act(async () => {
      const posted = await drafts.get("comment")!.publish();
      expect(posted?.replyToId).toBeUndefined();
    });
    act(() => {
      const draft = drafts.get("comment")!;
      draft.changeDraft({ ...draft.draft, body: "New standalone draft", key: "new" });
    });
    await act(async () => {
      release.resolve();
      const reply = await publishing;
      expect(reply?.replyToId).toBe(first.id);
    });
    expect(drafts.get("first")!.draft.body).toBe("");
    expect(drafts.get("comment")!.draft.body).toBe("New standalone draft");
    expect(drafts.get("second")!.draft.body).toBe("second");
  } finally {
    release.resolve();
    await act(async () => root?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("a failed reply keeps its text and attachments across resource navigation and retry", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const api = createMemoryActivity();
  const resource: ResourceRef = { projectId: "project", extensionId: "first.owner", type: "note", id: "same" };
  const other = { ...resource, extensionId: "second.owner" };
  const parent = await api.publish(resource, { key: "parent", kind: "comment", body: "Parent" });
  let reject = true;
  const binding: ResourceActivityBinding = {
    capabilities: { comments: true },
    api: {
      ...api,
      publish: async (target, input) => {
        if (reject) throw new Error("Publication unavailable");
        return api.publish(target, input);
      },
    },
    watch: async () => {},
  };
  let reply!: ReturnType<typeof useResourceActivityComposer>;
  const Draft = (props: { resource: ResourceRef }) => {
    reply = useResourceActivityComposer(workbench, binding, props.resource, { replyToId: parent.id });
    return null;
  };
  let root: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      root = create(<Draft resource={resource} />);
    });
    act(() => reply.changeDraft({ ...reply.draft, body: "Keep this reply", key: "reply" }));
    await act(async () => {
      await reply.attach(new File(["trace"], "trace.txt"));
    });
    const key = reply.draft.key;
    await act(async () => {
      await reply.publish();
    });
    expect(reply.error).toBe("Publication unavailable");
    expect(reply.draft.key).toBe(key);
    expect(reply.draft.attachments.map((file) => file.name)).toEqual(["trace.txt"]);
    await act(async () => root!.update(<Draft resource={other} />));
    expect(reply.draft.body).toBe("");
    expect(reply.error).toBeUndefined();
    act(() => reply.changeDraft({ ...reply.draft, body: "Other resource reply", key: "other" }));
    await act(async () => root!.update(<Draft resource={resource} />));
    expect(reply.draft.body).toBe("Keep this reply");
    expect(reply.error).toBe("Publication unavailable");
    reject = false;
    await act(async () => {
      const posted = await reply.publish();
      expect(posted?.replyToId).toBe(parent.id);
      expect(posted?.attachments.map((file) => file.name)).toEqual(["trace.txt"]);
    });
    expect(reply.draft.body).toBe("");
    await act(async () => root!.update(<Draft resource={other} />));
    expect(reply.draft.body).toBe("Other resource reply");
  } finally {
    await act(async () => root?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
