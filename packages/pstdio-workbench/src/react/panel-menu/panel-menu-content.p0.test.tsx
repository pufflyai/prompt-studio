import { afterEach, expect, spyOn, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, getWorkbenchRenderers, type WorkbenchWidgetPlacement } from "../../core";
import { treeMenuHasContent, usePanelMenuContent } from "./use-panel-menu-content";

test("a resource menu omits its sole self row but retains other resources and pagination", () => {
  const resource = { type: "ticket", id: "one" };
  const self = { id: "body", label: "Ticket", resource };
  const data = { header: [], body: [{ id: "files", nodes: [self] }], footer: [] };
  expect(treeMenuHasContent(data, resource)).toBe(false);
  expect(
    treeMenuHasContent(
      { ...data, body: [{ ...data.body[0], actions: [{ id: "new-file", label: "New file" }] }] },
      resource,
    ),
  ).toBe(false);
  expect(treeMenuHasContent(data)).toBe(true);
  const document = { ...resource, metadata: { documentId: "second" } };
  const linkedDocument = { ...self, id: "second", resource: document };
  const pagedSelf = { ...self, nextPage: async () => ({ nodes: [] }) };
  expect(
    treeMenuHasContent({ ...data, body: [{ id: "files", nodes: [self, linkedDocument] }] }, resource, "documentId"),
  ).toBe(true);
  expect(treeMenuHasContent({ ...data, body: [{ id: "files", nodes: [pagedSelf] }] }, resource)).toBe(true);
  data.body[0].nodes.push({ ...self, id: "other", resource: { ...resource, id: "two" } });
  expect(treeMenuHasContent(data, resource)).toBe(true);
  expect(
    treeMenuHasContent(
      { ...data, body: [{ ...data.body[0], nodes: [self], nextPage: async () => ({ nodes: [] }) }] },
      resource,
    ),
  ).toBe(true);
});

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
let renderer: ReactTestRenderer | undefined;
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  environment.IS_REACT_ACT_ENVIRONMENT = previousEnvironment;
});

test("absent panel menus own no view reads or unrelated context subscriptions", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const reads = spyOn(workbench.views.reads, "bind");
  const navigation = spyOn(workbench.navigationTrees, "onDidChange");
  const pages = spyOn(workbench.pages.store, "subscribe");
  const modes = spyOn(workbench.modes.store, "subscribe");
  const previews = spyOn(workbench.resources.preview.store, "subscribe");
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
    expect(pages).not.toHaveBeenCalled();
    expect(modes).not.toHaveBeenCalled();
    expect(previews).not.toHaveBeenCalled();
  } finally {
    await act(async () => renderer?.unmount());
    renderer = undefined;
    reads.mockRestore();
    navigation.mockRestore();
    pages.mockRestore();
    modes.mockRestore();
    previews.mockRestore();
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
