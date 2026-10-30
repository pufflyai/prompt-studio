import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchBreadcrumbView } from "./breadcrumb-view";

const DocumentBreadcrumb = () => {
  const [workbench] = useState(() => {
    const w = createWorkbench();
    const ref = (id: string) => ({ kind: "page" as const, extensionId: "story", id });
    const ticket = { type: "ticket", id: "one", label: "PS-1" };
    const document = { ...ticket, metadata: { document: "brief" } };
    w.modes.registerMode({ id: "project", activate() {} });
    w.resources.registerKind({ kind: "ticket", label: "Ticket" });
    w.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
    w.commands.registerCommand({ id: "edit-document", label: "Document controls" }, { execute() {} });
    w.pages.registerPage({
      id: "tickets",
      ref: ref("tickets"),
      title: "Tickets",
      path: "tickets",
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "one" },
      slots: [],
    });
    for (const id of ["ticket", "document"]) {
      w.pages.registerPage({
        id,
        ref: ref(id),
        title: id === "document" ? "Brief" : "Ticket",
        path: id,
        modeId: "project",
        parentId: id === "document" ? "ticket" : "tickets",
        resource: { kinds: [{ kind: "resource-kind", id: "ticket" }] },
        ...(id === "document" ? { document: { metadataKey: "document" } } : {}),
        main: {
          kind: "view",
          view: { kind: "view", id: "editor" },
          cardinality: "one",
          tab: {
            getSnapshot: () => ({
              menu: [
                {
                  id: "document",
                  rows: [
                    {
                      id: "controls",
                      label: "Document controls",
                      action: { kind: "command", commandId: "edit-document" },
                    },
                  ],
                },
              ],
            }),
          },
        },
        slots: [],
      });
    }
    w.pageLocations.setProject("story");
    w.pageLocations.navigate({
      kind: "page",
      page: ref("document"),
      resource: document,
      parent: { kind: "page", page: ref("ticket"), resource: ticket },
    });
    return w;
  });
  return (
    <WorkbenchThemeProvider>
      <WorkbenchBreadcrumbView workbench={workbench} />
    </WorkbenchThemeProvider>
  );
};
const meta = {
  title: "pstdio-workbench/Guides/Document breadcrumb",
  component: DocumentBreadcrumb,
} satisfies CanvasMeta<typeof DocumentBreadcrumb>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const ParentResourceAndDocument: Story = {
  id: "pstdio-workbench-guides-document-breadcrumb--parent-resource-and-document",
};
