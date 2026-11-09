import { expect, test } from "bun:test";
import { Activity } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, type TreeViewSection } from "../../../core";
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
