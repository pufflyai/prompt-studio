import { expect, test } from "bun:test";
import { Activity } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, getWorkbenchRenderers, type TreeViewSection } from "../../../core";
import { useTreeData } from "./use-tree-data";

test("an equal-data automatic root refresh keeps rendered paging usable and clean Activity returns reuse pages", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  let roots = 0;
  let continuations = 0;
  const sections: TreeViewSection[] = [
    {
      id: "history",
      nodes: [{ id: "one", label: "One" }],
      nextPage: async () => {
        continuations++;
        return { nodes: [{ id: "two", label: "Two" }] };
      },
    },
  ];
  workbench.views.registerView({
    id: "history",
    title: "History",
    body: {
      kind: "tree",
      getBody: () => {
        roots++;
        return sections;
      },
      getChildren: () => [],
    },
  });
  const values: Record<string, ReturnType<typeof useTreeData>> = {};
  const Capture = ({ name }: { name: string }) => {
    values[name] = useTreeData(workbench, "history", undefined, undefined, undefined, name);
    return null;
  };
  const content = (visible: boolean) => (
    <Activity mode={visible ? "visible" : "hidden"}>
      <Capture name="one" />
      <Capture name="two" />
    </Activity>
  );
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(content(true));
    });
    expect(roots).toBe(1);
    await act(async () => workbench.views.reads.invalidate("history"));
    expect(roots).toBe(2);
    await act(async () => {
      await values.one.body[0]!.pagination!.loadMore();
    });
    expect(continuations).toBe(1);
    expect(values.two.body[0]!.nodes.map((node) => node.id)).toEqual(["one", "two"]);
    await act(async () => renderer!.update(content(false)));
    await act(async () => renderer!.update(content(true)));
    expect(roots).toBe(2);
    expect(continuations).toBe(1);
    expect(values.one.body[0]!.nodes.map((node) => node.id)).toEqual(["one", "two"]);
  } finally {
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("expanded lazy folders introduced by later pages share child reads and refresh without toggling expansion", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  let children = [{ id: "old", label: "Old" }];
  let childReads = 0;
  let pageReads = 0;
  const sections: TreeViewSection[] = [
    {
      id: "history",
      nodes: [{ id: "first", label: "First" }],
      nextPage: async () => {
        pageReads++;
        return { nodes: [{ id: "folder", label: "Folder", collapsible: true }] };
      },
    },
  ];
  workbench.views.registerView({
    id: "history",
    title: "History",
    body: {
      kind: "tree",
      getBody: () => sections,
      getChildren: () => {
        childReads++;
        return children;
      },
    },
  });
  const values: Record<string, ReturnType<typeof useTreeData>> = {};
  const Capture = ({ name }: { name: string }) => {
    values[name] = useTreeData(workbench, "history", undefined, undefined, undefined, name);
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(
        <>
          <Capture name="one" />
          <Capture name="two" />
        </>,
      );
    });
    await act(async () => {
      await values.one.body[0]!.pagination!.loadMore();
    });
    await act(async () => {
      getWorkbenchRenderers(workbench).setNodeExpanded("history", "folder", true);
    });
    expect(childReads).toBe(1);
    expect(values.two.body[0]!.nodes[1]!.children?.map((node) => node.id)).toEqual(["old"]);
    children = [{ id: "new", label: "New" }];
    await act(async () => workbench.views.reads.invalidate("history"));
    expect(pageReads).toBe(2);
    expect(childReads).toBe(2);
    expect(values.one.body[0]!.nodes[1]!.children?.map((node) => node.id)).toEqual(["new"]);
    expect(values.two.body[0]!.nodes[1]!.children?.map((node) => node.id)).toEqual(["new"]);
    children = [];
    await act(async () => workbench.views.reads.invalidate("history"));
    expect(childReads).toBe(3);
    expect(values.one.body[0]!.nodes[1]!.children).toEqual([]);
  } finally {
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("returning while a cancelled later-page child drains resumes its shared read without a folder error", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const held = Promise.withResolvers<import("../../../core").TreeNode[]>();
  let childReads = 0;
  let signal!: AbortSignal;
  workbench.views.registerView({
    id: "history",
    title: "History",
    body: {
      kind: "tree",
      getBody: () => [
        {
          id: "history",
          nodes: [],
          nextPage: async () => ({ nodes: [{ id: "folder", label: "Folder", collapsible: true }] }),
        },
      ],
      getChildren: async (node, ctx) => {
        expect(node.children).toBeUndefined();
        signal = ctx.signal!;
        return ++childReads === 1 ? held.promise : [{ id: "fresh", label: "Fresh" }];
      },
    },
  });
  const values: Record<string, ReturnType<typeof useTreeData>> = {};
  const Capture = ({ name }: { name: string }) => {
    values[name] = useTreeData(workbench, "history", undefined, undefined, undefined, name);
    return null;
  };
  const content = (visible: boolean) => (
    <Activity mode={visible ? "visible" : "hidden"}>
      <Capture name="one" />
      <Capture name="two" />
    </Activity>
  );
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(content(true));
    });
    await act(async () => {
      await values.one.body[0]!.pagination!.loadMore();
    });
    await act(async () => {
      getWorkbenchRenderers(workbench).setNodeExpanded("history", "folder", true);
    });
    // An optimistic move's partial child projection cannot masquerade as authoritative folder contents.
    await act(async () =>
      values.one.loadChildren({ id: "folder", label: "Folder", children: [{ id: "partial", label: "Partial" }] }),
    );
    expect(childReads).toBe(1);
    await act(async () => renderer!.update(content(false)));
    expect(signal.aborted).toBe(true);
    await act(async () => renderer!.update(content(true)));
    expect(childReads).toBe(1);
    await act(async () => {
      held.resolve([{ id: "stale", label: "Stale" }]);
    });
    expect(childReads).toBe(2);
    expect(values.two.body[0]!.nodes[0]!.children?.map((node) => node.id)).toEqual(["fresh"]);
    expect(workbench.notifications.listNotifications()).toEqual([]);
  } finally {
    held.resolve([]);
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test.each([
  "accepted",
  "failed",
] as const)("fresh opaque structure nodes remain renderable through a %s native root read", async (outcome) => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const held = Promise.withResolvers<TreeViewSection[]>();
  const provenance = Symbol("provider");
  const provider = {};
  workbench.views.registerView({
    id: "navigation",
    title: "Navigation",
    body: {
      kind: "tree",
      getHeaderStructure: () => [
        {
          id: "header",
          nodes: [Object.defineProperty({ id: "project", label: "Project" }, provenance, { value: provider })],
        },
      ],
      getHeader: () => held.promise,
      getBody: () => held.promise,
      getFooter: () => held.promise,
      getChildren: () => [],
    },
  });
  let value: ReturnType<typeof useTreeData> | undefined;
  let renders = 0;
  const Capture = () => {
    if (++renders > 100) throw new Error("A native placeholder rendered repeatedly without an input change");
    value = useTreeData(workbench, "navigation");
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<Capture />);
    });
    expect(value?.header[0]?.nodes[0]?.label).toBe("Project");
    expect(Object.getOwnPropertyDescriptor(value?.header[0]?.nodes[0], provenance)?.value).toBe(provider);
    await act(async () => {
      if (outcome === "accepted") held.resolve([{ id: "header", nodes: [{ id: "accepted", label: "Accepted" }] }]);
      else held.reject(new Error("Read interrupted"));
    });
    if (outcome === "accepted") expect(value?.header[0]?.nodes[0]?.label).toBe("Accepted");
    else {
      expect(value?.error).toBe("Read interrupted");
      expect(value?.header[0]?.nodes[0]?.label).toBe("Project");
    }
  } finally {
    held.resolve([]);
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
