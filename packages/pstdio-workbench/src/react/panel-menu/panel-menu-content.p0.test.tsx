import { afterEach, expect, spyOn, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, getWorkbenchRenderers, type WorkbenchWidgetPlacement } from "../../core";
import { usePanelMenuContent } from "./use-panel-menu-content";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
let renderer: ReactTestRenderer | undefined;
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  environment.IS_REACT_ACT_ENVIRONMENT = previousEnvironment;
});

test("absent panel menus own no view reads or navigation subscriptions", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const reads = spyOn(workbench.views.reads, "bind");
  const navigation = spyOn(workbench.navigationTrees, "onDidChange");
  const Probe = () => {
    usePanelMenuContent(workbench);
    return null;
  };
  try {
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(reads).not.toHaveBeenCalled();
    expect(navigation).not.toHaveBeenCalled();
  } finally {
    await act(async () => renderer?.unmount());
    renderer = undefined;
    reads.mockRestore();
    navigation.mockRestore();
    await workbench.dispose();
  }
});

test("menu reads start and stop with the actual tree while content and resource owners stay current", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const owners: string[] = [];
  getWorkbenchRenderers(workbench).registerTreeRenderer({
    id: "links",
    title: "Links",
    getChildren: () => [],
    getBody: ({ resource }) => {
      owners.push(resource?.id ?? "missing");
      return resource?.id === "linked" ? [{ id: "links", nodes: [{ id: "ticket", label: "Ticket" }] }] : [];
    },
  });
  let present = false;
  const Probe = ({ placement }: { placement?: WorkbenchWidgetPlacement }) => {
    present = usePanelMenuContent(workbench, placement);
    return null;
  };
  const placement = (id: string): WorkbenchWidgetPlacement => ({
    widgetId: "links",
    contributionId: "links",
    viewId: "links",
    resource: { type: "session", id },
  });
  try {
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(owners).toEqual([]);
    await act(async () => renderer!.update(<Probe placement={placement("empty")} />));
    expect(present).toBe(false);
    await act(async () => renderer!.update(<Probe placement={placement("linked")} />));
    expect(present).toBe(true);
    expect(owners).toEqual(["empty", "linked"]);
    await act(async () => renderer!.update(<Probe />));
    expect(owners).toEqual(["empty", "linked"]);
  } finally {
    await act(async () => renderer?.unmount());
    renderer = undefined;
    await workbench.dispose();
  }
});

test("a menu starts observing when its tree registers after the placement mounts", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  let calls = 0;
  const Probe = () => {
    usePanelMenuContent(workbench, { widgetId: "late", contributionId: "late", viewId: "late" });
    return null;
  };
  try {
    await act(async () => {
      renderer = create(<Probe />);
    });
    await act(async () => {
      getWorkbenchRenderers(workbench).registerTreeRenderer({
        id: "late",
        title: "Late links",
        getChildren: () => [],
        getBody: () => {
          calls++;
          return [];
        },
      });
    });
    expect(calls).toBe(1);
  } finally {
    await act(async () => renderer?.unmount());
    renderer = undefined;
    await workbench.dispose();
  }
});
