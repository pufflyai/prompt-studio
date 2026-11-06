import { Button, CloseButton, HStack, Stack } from "@chakra-ui/react";
import { ScopedDialog as Dialog, getIconComponent, ScrollArea } from "@pstdio/ui";
import { KanbanRendererList } from "@pstdio/ui/kanban-renderer";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useState } from "react";
import { WorktreeChanges } from "./workspaces.canvas";

export default { title: "Product/Workspaces/Device menus and compact dialogs", fullscreen: true };
const Folder = getIconComponent("folder");
const Monitor = getIconComponent("monitor");
const Plus = getIconComponent("plus");

const DeviceMenuPreview = (props: { initial?: "create" }) => {
  const [dialog, setDialog] = useState(props.initial);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({ base: "main" });
  const close = () => setDialog(undefined);
  return (
    <>
      <KanbanRendererList
        items={[
          {
            id: "local",
            title: "MacBook Pro",
            isGroup: true,
            countBadge: 1,
            statusIcon: Monitor,
            contextMenuActions: [
              {
                key: "create",
                label: "Create workspace",
                onClick: () => setDialog("create"),
              },
            ],
            children: [{ id: "project", title: "Project folder", statusIcon: Folder }],
          },
          {
            id: "remote",
            title: "Build box",
            isGroup: true,
            countBadge: 0,
            statusIcon: Monitor,
          },
        ]}
      />
      <Dialog.Root
        open={Boolean(dialog)}
        size="lg"
        scrollBehavior="inside"
        onOpenChange={({ open }) => !open && close()}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content display="flex" flexDirection="column">
            <Dialog.Header>
              <Dialog.Title>Create workspace</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body p="0" minH="0">
              <ScrollArea contentProps={{ px: "sm", py: "md" }}>
                <ParamEditor
                  changeDelay={0}
                  fullWidth
                  params={[
                    {
                      id: "provider",
                      name: "Workspace type",
                      type: "selection",
                      defaultValue: "git",
                      options: [{ id: "git", name: "Git worktree" }],
                    },
                    { id: "base", name: "Base branch", type: "text", defaultValue: "main" },
                  ]}
                  defaultValues={values}
                  onChange={(id, value) =>
                    setValues((current) => ({ ...current, [id]: value as string | number | boolean }))
                  }
                />
              </ScrollArea>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap="2">
                <Button size="sm" variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={close}>
                  <Plus size={14} /> Create workspace
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
};
export const DeviceContextMenu = () => <DeviceMenuPreview />;
export const CreateWorkspaceModal = () => <DeviceMenuPreview initial="create" />;
export const ChangesWithoutOptions = () => (
  <Stack h="full">
    <WorktreeChanges />
  </Stack>
);
