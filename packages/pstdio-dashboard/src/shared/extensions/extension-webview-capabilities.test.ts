import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { createExtensionWebviewHostCapabilities } from "@pstdio/workbench/extensions";
import { WEBVIEW_HOST_CAPABILITIES } from "pstdio-api-contracts/extension-kernel";
import { createDashboardExtensionWebviewAdapters } from "./extension-webview-capabilities";

test("dashboard adapters keep the shared capability contract without an owner", async () => {
  const capabilities = createExtensionWebviewHostCapabilities(
    createDashboardExtensionWebviewAdapters({
      base: {},
      extensionId: "pstdio.lab",
      webviewId: "view-1",
    }),
  );
  expect(Object.keys(capabilities).sort()).toEqual([...WEBVIEW_HOST_CAPABILITIES].sort());
  for (const capability of WEBVIEW_HOST_CAPABILITIES) {
    await expect(Promise.resolve().then(() => capabilities[capability]({}))).rejects.toMatchObject({
      code: "unsupported",
      data: { capability },
    });
  }
});

test("dashboard adapters preserve command outcomes and qualify navigation once", async () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "tickets", title: "Tickets", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "pstdio.lab.page.tickets",
    ref: { extensionId: "pstdio.lab", kind: "page", id: "tickets" },
    title: "Tickets",
    path: "tickets",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "tickets" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.setProject("project-1");
  const outcome = { ok: false, status: "rejected", code: "stale_revision", reason: "Changed", data: { revision: 2 } };
  const adapters = createDashboardExtensionWebviewAdapters({
    base: { executeCommand: async () => ({ outcome }) },
    extensionId: "pstdio.lab",
    projectId: "project-1",
    webviewId: "view-1",
    workbench,
  });
  const capabilities = createExtensionWebviewHostCapabilities(adapters);
  expect(await capabilities["commands.execute"]({ commandId: "save" })).toEqual({ outcome });
  expect(
    await capabilities["navigation.open"]({ target: { kind: "page", page: { kind: "page", id: "tickets" } } }),
  ).toBeUndefined();
  expect(workbench.pages.store.getState().location?.page).toEqual({
    extensionId: "pstdio.lab",
    kind: "page",
    id: "tickets",
  });
});

test("dashboard owner adapters provide file and artifact services", () => {
  const adapters = createDashboardExtensionWebviewAdapters({
    base: {},
    extensionId: "pstdio.lab",
    extensionInstanceId: "instance-1",
    projectId: "project-1",
    webviewId: "view-1",
  });
  expect(adapters.files?.upload).toBeFunction();
  expect(adapters.files?.list).toBeFunction();
  expect(adapters.files?.delete).toBeFunction();
  expect(adapters.artifacts?.read).toBeFunction();
});
