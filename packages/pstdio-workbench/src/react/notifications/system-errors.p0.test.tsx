import { expect, test } from "bun:test";
import { EnvironmentProvider } from "@chakra-ui/react";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { act, create } from "react-test-renderer";
import { createWorkbench } from "../../core";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { useWorkbenchLayoutFlags } from "../workbench/use-workbench-layout-flags";
import { OperationRecoveryItem } from "./operation-recovery";
import { systemActivityItemId, useSystemActivityStatusItem } from "./system-errors";

test("system notices appear only while needed and keep the person's widget alignment", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const Status = () => {
    useSystemActivityStatusItem(workbench, true);
    return null;
  };
  let tree: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<Status />);
  });
  try {
    expect(workbench.statusBar.listVisibleItems()).toHaveLength(0);
    await act(async () => {
      workbench.notifications.show({ id: "inline", level: "error", title: "Save failed", inlineTarget: "editor" });
    });
    expect(workbench.statusBar.listVisibleItems()).toHaveLength(0);
    await act(async () => {
      workbench.notifications.show({ id: "update", level: "info", title: "Update ready" });
    });
    expect(workbench.statusBar.getItem(systemActivityItemId)?.popoverViewId).toBeDefined();
    await act(async () => {
      workbench.statusBar.moveItem(systemActivityItemId, "trailing");
    });
    await act(async () => {
      workbench.notifications.dismiss("update");
    });
    expect(workbench.statusBar.listVisibleItems()).toHaveLength(0);
    await act(async () => {
      workbench.notifications.show({ id: "connection", level: "error", title: "Connection failed" });
    });
    expect(workbench.statusBar.getItem(systemActivityItemId)?.slot).toBe("trailing");
  } finally {
    await act(async () => {
      tree!.unmount();
    });
    workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("scoped recovery keeps the widget reachable after an alert is dismissed", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const queries = createScopedQueryClient({ runtimeId: "desktop", accountId: "person", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  const operations = getWorkbenchOperations(queries);
  const Status = () => {
    useSystemActivityStatusItem(workbench, true);
    return null;
  };
  let tree: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<Status />);
  });
  try {
    await act(async () => {
      const attempt = operations.submit({
        domain: "settings",
        subjects: ["installation"],
        title: "Change settings",
        draft: true,
        write: () => {
          throw new Error("Change rejected");
        },
        classify: () => "rejected",
      });
      await expect(attempt.result).rejects.toThrow("Change rejected");
      operations.dismiss(attempt.id);
    });
    expect(workbench.statusBar.getItem(systemActivityItemId)?.popoverViewId).toBeDefined();
    await act(async () => queries.setAuthority({ accountId: "other" }));
    expect(workbench.statusBar.listVisibleItems()).toHaveLength(0);
    await act(async () => queries.setAuthority({ accountId: "person" }));
    expect(workbench.statusBar.getItem(systemActivityItemId)?.popoverViewId).toBeDefined();
  } finally {
    await act(async () => {
      tree!.unmount();
    });
    await workbench.dispose();
    queries.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("live recovery follows the selected project and unavailable project recovery stays reachable", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const queries = createScopedQueryClient({ runtimeId: "desktop", accountId: "person", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  workbench.pageLocations.setProject("original");
  const operations = getWorkbenchOperations(queries);
  const Status = () => <span>{useSystemActivityStatusItem(workbench, true)}</span>;
  let tree: ReturnType<typeof create> | undefined;
  let item: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      tree = create(<Status />);
      const attempt = operations.submit({
        projectId: "original",
        domain: "links",
        subjects: ["original-resource"],
        title: "Link resources",
        draft: "Original relationship",
        write: async () => {
          throw new Error("Reply lost");
        },
      });
      await expect(attempt.result).rejects.toThrow("Reply lost");
    });
    expect(tree!.root.findByType("span").children).toEqual(["System errors: Link resources"]);
    await act(async () => workbench.pageLocations.setProject("different"));
    expect(tree!.root.findByType("span").children).toEqual([]);
    await act(async () => workbench.pageLocations.setProject("original"));
    await act(async () => operations.discard(operations.getSnapshot().recovery[0]!.id));
    expect(operations.getSnapshot().pending).toHaveLength(1);
    await act(async () => workbench.pageLocations.setProject("different"));
    await act(async () => queries.setAuthority({ accountId: "other" }));
    await act(async () => queries.setAuthority({ accountId: "person" }));
    expect(tree!.root.findByType("span").children).toEqual([]);
    await act(async () => {
      queries.clearScope({ projectId: "original" });
      operations.updateRetiredProjectAvailability(() => false);
    });
    expect(tree!.root.findByType("span").children).toEqual(["System errors: Link resources"]);
    await act(async () => queries.setAuthority({ accountId: "other" }));
    expect(tree!.root.findByType("span").children).toEqual([]);
    await act(async () => {
      queries.setAuthority({ accountId: "person" });
      operations.updateRetiredProjectAvailability(() => false);
    });
    const entry = operations.getSnapshot().recovery[0]!;
    const root = Object.assign(new EventTarget(), {
      nodeType: 9,
      getElementById: () => null,
      defaultView: {},
    }) as unknown as Document;
    await act(async () => {
      item = create(
        <EnvironmentProvider value={root}>
          <WorkbenchThemeProvider>
            <OperationRecoveryItem entry={entry} workbench={workbench} />
          </WorkbenchThemeProvider>
        </EnvironmentProvider>,
      );
    });
    const clear = item!.root.findAllByType("button").find((button) => button.children.includes("Clear"));
    expect(clear).toBeDefined();
    await act(async () => clear!.props.onClick());
    expect(operations.getSnapshot().recovery).toEqual([]);
    expect(tree!.root.findByType("span").children).toEqual([]);
  } finally {
    await act(async () => item?.unmount());
    await act(async () => tree?.unmount());
    await workbench.dispose();
    queries.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("System activity shows an extension action while leaving quiet writes silent", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  workbench.pageLocations.setProject("project");
  const operations = getWorkbenchOperations(queries);
  let flags: ReturnType<typeof useWorkbenchLayoutFlags> | undefined;
  const Status = () => {
    flags = useWorkbenchLayoutFlags(workbench);
    return <span>{useSystemActivityStatusItem(workbench, true)}</span>;
  };
  let tree: ReturnType<typeof create>;
  const quiet = Promise.withResolvers<void>();
  const publication = Promise.withResolvers<void>();
  const start = (title: string, write: () => Promise<void>, showPending?: true) =>
    operations.submit({ domain: "fixture", projectId: "project", subjects: [title], title, showPending, write }).result;
  try {
    await act(async () => {
      tree = create(<Status />);
    });
    await act(async () => {
      void start("Save file", () => quiet.promise);
    });
    expect(workbench.statusBar.listVisibleItems()).toHaveLength(0);
    await act(async () => {
      void start("Publish artifact", () => publication.promise, true);
    });
    expect(flags?.hasDockedStatusBar).toBe(true);
    expect(tree!.root.findByType("span").children).toEqual(["System activity: Publish artifact"]);
    expect(workbench.statusBar.getItem(systemActivityItemId)?.popoverViewId).toBeDefined();
    await act(async () => {
      publication.resolve();
    });
    expect(workbench.statusBar.listVisibleItems()).toHaveLength(0);
    expect(flags?.hasStatusContent).toBe(false);
  } finally {
    await act(async () => {
      publication.resolve();
      quiet.resolve();
      tree!.unmount();
    });
    await workbench.dispose();
    queries.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
