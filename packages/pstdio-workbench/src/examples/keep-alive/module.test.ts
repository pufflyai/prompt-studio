import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createKeepAliveExampleModule } from "./module";

interface FakeNode {
  parentNode?: FakeNode;
  children: FakeNode[];
  appendChild(child: FakeNode): void;
  removeChild(child: FakeNode): void;
  contains(child: FakeNode): boolean;
}

const createFakeNode = (): FakeNode => {
  const node: FakeNode = {
    children: [],
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = node;
      node.children.push(child);
    },
    removeChild(child) {
      const index = node.children.indexOf(child);
      if (index === -1) return;
      node.children.splice(index, 1);
      if (child.parentNode === node) child.parentNode = undefined;
    },
    contains(child) {
      return node.children.includes(child);
    },
  };
  return node;
};

const createKeepAliveWorkbench = () =>
  createWorkbenchCore({
    initialSessionPanelMode: "attached",
    renderers: { createHost: () => createFakeNode() as unknown as HTMLElement },
  });

describe("createKeepAliveExampleModule", () => {
  test("opens the demo with a primary resource so attached chat can render in main-right", () => {
    const workbench = createKeepAliveWorkbench();

    workbench.registerModule(createKeepAliveExampleModule());

    const layout = workbench.layout.getLayout();
    expect(layout.regions.main.widgets[0]?.resource).toMatchObject({
      kind: "workbench-example",
      uri: "pstdio://examples/keep-alive",
    });
    expect(layout.regions["main-right-menu"].widgets).toHaveLength(1);

    workbench.sessionPanel.setMode("bubble");
    workbench.sessionPanel.setMode("attached");

    const attachedLayout = workbench.layout.getLayout();
    expect(attachedLayout.regions.side.widgets).toHaveLength(0);
    expect(attachedLayout.regions["main-right-menu"].widgets).toHaveLength(1);
    expect(attachedLayout.regions.main.widgets[0]?.resource).toBeDefined();
  });
});
