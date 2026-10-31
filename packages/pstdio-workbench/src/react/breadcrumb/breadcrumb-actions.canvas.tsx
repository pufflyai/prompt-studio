import { Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useRef, useState } from "react";
import { createWorkbench } from "../../core";
import { runResourceMutation } from "../../extensions/host/workbench-resource-mutation";
import { PaletteParamsDialog } from "../command-palette/palette-params-dialog";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchBreadcrumbView } from "./breadcrumb-view";

const NoteBreadcrumb = (props: { optimistic?: boolean }) => {
  const { optimistic = false } = props;
  const save = useRef<
    | {
        resolve(): void;
        reject(error: Error): void;
      }
    | undefined
  >(undefined);
  const waitForSave = () =>
    optimistic ? new Promise<void>((resolve, reject) => (save.current = { resolve, reject })) : Promise.resolve();
  const [result, setResult] = useState("No action run");
  const [workbench] = useState(() => {
    const page = { kind: "page" as const, extensionId: "preview", id: "notes" };
    const instance = createWorkbench({ startPage: page });
    const listeners = new Set<() => void>();
    let title = "Research note";
    const resource = {
      type: "note",
      id: "note-1",
      label: title,
      projectId: "preview-notes",
      extensionId: "preview",
    };
    const mutation = (kind: "rename" | "remove") =>
      kind === "rename"
        ? ({ kind, resourceType: "note", idParam: "noteId", labelParam: "title" } as const)
        : ({ kind, resourceType: "note", idParam: "noteId" } as const);
    const run = (kind: "rename" | "remove", args: unknown, persist: () => Promise<void>) =>
      optimistic
        ? runResourceMutation(
            { workbench: instance, projectId: "preview-notes", executeCommand: () => undefined },
            {
              id: kind,
              title: kind === "remove" ? "Delete note" : "Rename note",
              extensionId: "preview",
              resourceMutation: mutation(kind),
            },
            args as Record<string, unknown>,
            undefined,
            persist,
          )
        : persist();
    const noteId = { type: "text" as const, label: "Note", required: true, resolvedFrom: "resource" as const };
    instance.modes.registerMode({ id: "project", activate: () => undefined });
    instance.resources.registerKind({ kind: "note", label: "Note", icon: "file-text" });
    instance.views.registerView({ id: "editor", title: "Editor", body: { kind: "react", render: () => null } });
    instance.commands.registerCommand(
      {
        id: "rename",
        label: "Rename note",
        resourceMutation: optimistic ? mutation("rename") : undefined,
        params: { noteId, title: { type: "text", label: "Title", required: true } },
      },
      {
        execute: (args) =>
          run("rename", args, async () => {
            await waitForSave();
            title = (
              args as {
                title: string;
              }
            ).title;
            for (const listener of listeners) listener();
            setResult(
              `Renamed ${
                (
                  args as {
                    noteId: string;
                  }
                ).noteId
              }`,
            );
          }),
      },
    );
    instance.commands.registerCommand(
      {
        id: "delete",
        label: "Delete",
        params: { noteId },
        resourceMutation: optimistic ? mutation("remove") : undefined,
      },
      {
        execute: (args) =>
          run("remove", args, async () => {
            await waitForSave();
            const placement = instance.layout
              .getLayout()
              .regions.main.widgets.find((widget) => widget.resource?.id === resource.id);
            if (placement?.placementIdentity) instance.closePlacement(placement.placementIdentity);
            setResult(
              `Deleted ${
                (
                  args as {
                    noteId: string;
                  }
                ).noteId
              }`,
            );
          }),
      },
    );
    instance.pages.registerPage({
      id: page.id,
      ref: page,
      title: "Notes",
      icon: "notebook-pen",
      path: "notes",
      modeId: "project",
      main: { kind: "panels", empty: { kind: "view", id: "editor" } },
      slots: [
        {
          id: "note",
          region: "main",
          item: {
            kind: "binding",
            binding: {
              kinds: [{ kind: "resource-kind", id: "note" }],
              view: { kind: "view", id: "editor" },
              cardinality: "many",
            },
          },
          tab: {
            subscribe: (listener) => {
              listeners.add(listener);
              return () => listeners.delete(listener);
            },
            getSnapshot: () => ({
              label: title,
              menu: [
                {
                  id: "note",
                  rows: [
                    {
                      id: "rename",
                      label: "Rename note",
                      icon: "pencil",
                      action: {
                        kind: "navigation",
                        target: {
                          kind: "command",
                          commandId: "rename",
                          args: { noteId: resource.id, title },
                        },
                      },
                    },
                    {
                      id: "delete",
                      label: "Delete",
                      icon: "trash",
                      action: {
                        kind: "navigation",
                        target: {
                          kind: "command",
                          commandId: "delete",
                          args: { noteId: resource.id },
                        },
                      },
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    });
    instance.pageLocations.setProject("preview-notes");
    instance.pageLocations.navigate({ kind: "page", page });
    instance.pages.openSlot({ pageId: page.id, slotId: "note", resource });
    return instance;
  });
  return (
    <Stack>
      <WorkbenchBreadcrumbView workbench={workbench} />
      <Text>{result}</Text>
      {optimistic ? (
        <Stack direction="row">
          <Button
            onClick={() => {
              save.current?.resolve();
              save.current = undefined;
            }}
          >
            Finish save
          </Button>
          <Button
            onClick={() => {
              save.current?.reject(new Error("Save failed"));
              save.current = undefined;
            }}
          >
            Fail save
          </Button>
        </Stack>
      ) : null}
      <PaletteParamsDialog workbench={workbench} />
    </Stack>
  );
};
const meta = {
  title: "pstdio-workbench/Guides/Breadcrumb resource actions",
  component: NoteBreadcrumb,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies CanvasMeta<typeof NoteBreadcrumb>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const SelectedNote: Story = {
  id: "pstdio-workbench-guides-breadcrumb-resource-actions--selected-note",
};
export const OptimisticResourceActions: Story = {
  id: "pstdio-workbench-guides-breadcrumb-resource-actions--optimistic-resource-actions",
  args: { optimistic: true },
};
