import { Box, Button, CloseButton, Flex, HStack } from "@chakra-ui/react";
import { ScopedDialog as Dialog, Portal, ResizableSplitLayout, ScrollArea, TreeList } from "@pstdio/ui";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench, WorkbenchIcon } from "@pstdio/workbench/react";
import { useState } from "react";
import { settingsPages } from "./settings-fixtures";
import { SettingsLeaveWarning, useSettingsLeaveGuard } from "./settings-leave-warning";
import { SettingsNavigationSkeleton } from "./settings-loading";
import { SettingsPanel } from "./settings-panel";

const sections = [
  { id: "workbench", label: "Workbench" },
  { id: "project", label: "Project" },
  { id: "planner", label: "Project Planner" },
  { id: "experimental", label: "Experimental" },
];

interface SettingsOverlayProps {
  initialPage?: string;
  state?: "ready" | "error" | "loading";
  navState?: "ready" | "loading";
}

// Proposal copy of the settings shell: shared navigation and split layout, with
// leave confirmation owned here so both navigation and closing follow it.
const SettingsOverlay = (props: SettingsOverlayProps) => {
  const { initialPage = "runtime", state = "ready", navState = "ready" } = props;
  const [workbench] = useState(() => createWorkbench());
  const [pageId, setPageId] = useState(initialPage);
  const [open, setOpen] = useState(true);
  const guard = useSettingsLeaveGuard();
  const close = () => guard.request(() => setOpen(false));
  return (
    <Box h="100vh">
      <Workbench workbench={workbench} />
      {!open ? <Button onClick={() => setOpen(true)}>Open settings</Button> : null}
      <Dialog.Root
        open={open}
        size="xl"
        scrollBehavior="inside"
        closeOnInteractOutside={false}
        onOpenChange={(details) => {
          if (!details.open) close();
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content h="min(760px, 88vh)" w="94vw" maxW="min(1440px, 94vw)" overflow="hidden">
              <Dialog.Header bg="bg.subtle" borderBottomWidth="1px" borderColor="border.subtle">
                <HStack gap="sm">
                  <WorkbenchIcon name="settings" />
                  <Dialog.Title>Settings</Dialog.Title>
                </HStack>
              </Dialog.Header>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" aria-label="Close settings" />
              </Dialog.CloseTrigger>
              <Flex flex="1" minH="0" position="relative">
                <ResizableSplitLayout
                  position="absolute"
                  inset="0"
                  resizableSide="left"
                  defaultSizePx={280}
                  minSizePx={220}
                  maxSizePx={420}
                  contentMinSizePx={360}
                  collapsible={false}
                  resizeLabel="Resize settings navigation"
                  separator="line"
                  resizablePanel={
                    <Box
                      as="nav"
                      aria-label="Settings navigation"
                      aria-busy={navState === "loading"}
                      h="full"
                      bg="bg.subtle"
                    >
                      <ScrollArea h="full" contentProps={{ p: "sm" }}>
                        {navState === "loading" ? (
                          <SettingsNavigationSkeleton />
                        ) : (
                          <TreeList
                            activeNodeId={pageId}
                            rowVariant="compact"
                            sectionGap="md"
                            nodeGap="1px"
                            expandedSectionIds={sections.map((section) => section.id)}
                            sections={sections.map((section) => ({
                              ...section,
                              collapsible: false,
                              nodes: settingsPages
                                .filter((page) => page.section === section.id)
                                .map((page) => ({
                                  id: page.id,
                                  label: page.title,
                                  icon: <WorkbenchIcon name={page.icon} />,
                                  onActivate: () => {
                                    if (page.id !== pageId) guard.request(() => setPageId(page.id));
                                  },
                                })),
                            }))}
                          />
                        )}
                      </ScrollArea>
                    </Box>
                  }
                  contentPanel={
                    <ScrollArea h="full" aria-busy={state === "loading"}>
                      <SettingsPanel key={pageId} pageId={pageId} state={state} />
                    </ScrollArea>
                  }
                />
              </Flex>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
};

export const SettingsDesign = (props: SettingsOverlayProps) => (
  <SettingsLeaveWarning>
    <SettingsOverlay {...props} />
  </SettingsLeaveWarning>
);
