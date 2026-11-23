import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { act, create } from "react-test-renderer";
import { createWorkbench } from "../../core";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
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

test("System activity shows an extension action while leaving quiet writes silent", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  workbench.pageLocations.setProject("project");
  const operations = getWorkbenchOperations(queries);
  const Status = () => <span>{useSystemActivityStatusItem(workbench, true)}</span>;
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
    expect(tree!.root.findByType("span").children).toEqual(["System activity: Publish artifact"]);
    expect(workbench.statusBar.getItem(systemActivityItemId)?.popoverViewId).toBeDefined();
    await act(async () => {
      publication.resolve();
    });
    expect(workbench.statusBar.listVisibleItems()).toHaveLength(0);
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
