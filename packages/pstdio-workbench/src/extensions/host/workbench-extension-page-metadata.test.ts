import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { toInternalWorkbenchPages } from "./workbench-extension-page-metadata";

test("adapts page side policy and default targets without changing legacy Side slots", () => {
  const view = { kind: "view", extensionId: "example", id: "content" } as const;
  const page = {
    id: "example.page.tools",
    localId: "tools",
    extensionId: "example",
    title: "Tools",
    path: "tools",
    mode: { kind: "mode", extensionId: "example", id: "project" },
    main: { kind: "panels", empty: view },
    regionSettings: {
      aside: {
        canClose: false,
        acceptsTabs: true,
        defaultTab: {
          kind: "panel",
          panel: { kind: "page-slot", page: { kind: "page", extensionId: "example", id: "tools" }, id: "session" },
        },
      },
    },
    slots: ["aside", "side"].map((region) => ({ id: region, region, item: { kind: "view", view, presence: "open" } })),
  } as WorkbenchExtensionMetadata["pages"][number];
  const [adapted] = toInternalWorkbenchPages({ pages: [page] } as WorkbenchExtensionMetadata);
  expect(adapted?.slots.map((slot) => slot.region)).toEqual(["aside", "side"]);
  expect(adapted?.regionSettings?.aside).toMatchObject({
    canClose: false,
    acceptsTabs: true,
    defaultTab: { kind: "panel" },
  });
});
