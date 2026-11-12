import { expect, test } from "bun:test";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { createMemoryActivity } from "@pstdio/sdk/testing";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench } from "../../core";
import type { ResourceActivityBinding } from "../../core/registries/resources/resource-activity";
import { useResourceActivity } from "./use-resource-activity";

test("a late comment response preserves newer drafts and remains bound to its full resource identity", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const api = createMemoryActivity();
  const sent = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const binding: ResourceActivityBinding = {
    capabilities: { comments: true },
    api: {
      ...api,
      publish: async (resource, input) => {
        sent.resolve();
        await release.promise;
        return api.publish(resource, input);
      },
    },
    watch: async (_resource, input) => {
      input.onReady?.();
      await new Promise<void>((resolve) => input.signal.addEventListener("abort", () => resolve(), { once: true }));
    },
  };
  const first: ResourceRef = { projectId: "project", extensionId: "first.owner", type: "note", id: "same" };
  const second = { ...first, extensionId: "second.owner" };
  let current!: ReturnType<typeof useResourceActivity>;
  const Fixture = (props: { resource: ResourceRef }) => {
    current = useResourceActivity(workbench, binding, props.resource, true);
    return null;
  };
  let root: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      root = create(<Fixture key="first" resource={first} />);
    });
    act(() => current.changeDraft({ ...current.draft, body: "Submitted", key: "sent" }));
    let publishing: ReturnType<typeof current.publish> | undefined;
    await act(async () => {
      publishing = current.publish();
      await sent.promise;
    });
    act(() => current.changeDraft({ ...current.draft, body: "New draft", key: "new" }));
    await act(async () => {
      root!.update(<Fixture key="second" resource={second} />);
    });
    expect(current.draft.body).toBe("");
    act(() => current.changeDraft({ ...current.draft, body: "Other resource", key: "other" }));
    await act(async () => {
      release.resolve();
      await publishing;
    });
    expect(current.draft.body).toBe("Other resource");
    expect(current.items).toEqual([]);
    await act(async () => {
      root!.update(<Fixture key="first" resource={first} />);
    });
    expect(current.draft.body).toBe("New draft");
    expect(current.items.map((entry) => entry.body)).toEqual(["Submitted"]);
  } finally {
    release.resolve();
    await act(async () => root?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("an attachment finishing after navigation updates the remounted resource draft", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const api = createMemoryActivity();
  const sent = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const binding: ResourceActivityBinding = {
    capabilities: { comments: true },
    api: {
      ...api,
      attach: async (resource, file) => {
        sent.resolve();
        await release.promise;
        return api.attach(resource, file);
      },
    },
    watch: async (_resource, input) => {
      input.onReady?.();
      await new Promise<void>((resolve) => input.signal.addEventListener("abort", () => resolve(), { once: true }));
    },
  };
  const first: ResourceRef = { projectId: "project", extensionId: "first.owner", type: "note", id: "same" };
  const second = { ...first, extensionId: "second.owner" };
  let current!: ReturnType<typeof useResourceActivity>;
  const Fixture = (props: { resource: ResourceRef }) => {
    current = useResourceActivity(workbench, binding, props.resource, true);
    return null;
  };
  let root: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      root = create(<Fixture key="first" resource={first} />);
    });
    act(() => current.changeDraft({ ...current.draft, body: "Keep me", key: "draft" }));
    let attaching: ReturnType<typeof current.attach> | undefined;
    await act(async () => {
      attaching = current.attach(new File(["evidence"], "trace.log", { type: "text/plain" }));
      await sent.promise;
    });
    await act(async () => {
      root!.update(<Fixture key="second" resource={second} />);
    });
    await act(async () => {
      root!.update(<Fixture key="first" resource={first} />);
    });
    await act(async () => {
      release.resolve();
      await attaching;
    });
    expect(current.draft.attachmentIds).toHaveLength(1);
    act(() => current.changeDraft({ ...current.draft, body: "Edited", key: "edited" }));
    await act(async () => {
      root!.update(<Fixture key="second" resource={second} />);
    });
    await act(async () => {
      root!.update(<Fixture key="first" resource={first} />);
    });
    expect(current.draft.attachmentIds).toHaveLength(1);
  } finally {
    release.resolve();
    await act(async () => root?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
