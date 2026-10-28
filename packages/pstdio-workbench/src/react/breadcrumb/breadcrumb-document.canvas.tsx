import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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

const meta = { title: "pstdio-workbench/Guides/Document breadcrumb", component: DocumentBreadcrumb } satisfies Meta<
  typeof DocumentBreadcrumb
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ParentResourceAndDocument: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.pointer({ target: canvas.getByText("PS-1", { exact: true }), keys: "[MouseRight]" });
    await expect(body.queryByRole("menuitem", { name: "Document controls" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.pointer({ target: canvas.getByText("Brief", { exact: true }), keys: "[MouseRight]" });
    await expect(await body.findByRole("menuitem", { name: "Document controls" })).toBeVisible();
  },
};
