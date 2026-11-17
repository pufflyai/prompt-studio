import { Box, CloseButton, Dialog, HStack, Portal, Stack, Text } from "@chakra-ui/react";
import { installPrismGlobal, ListRow } from "@pstdio/ui";
import { ChartNoAxesGantt, Folder, Play, SquareKanban } from "lucide-react";
import { useState } from "react";
import { autoBuildStoryConfiguration } from "../../src/timeline/view/auto-build.story-fixture";
import { AutoBuildForm } from "../../src/timeline/view/auto-build-form";
import { AutoBuildIndicator } from "../../src/timeline/view/auto-build-indicator";
import { AutoBuildActivity } from "./auto-build-activity";

const t = (_key: string, fallback?: string) => fallback ?? _key;

export function PlannerNavigation({ defaultOpen }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [enabled, setEnabled] = useState(true);
  const [paused, setPaused] = useState(false);
  const [configuration, setConfiguration] = useState(false);
  const [session, setSession] = useState<string>();
  return (
    <Stack w="xs" flexShrink="0" borderRightWidth="1px" borderColor="border.subtle" gap="md" p="xs">
      <HStack px="sm" py="xs">
        <Folder />
        <Text textStyle="label/S/medium">Prompt Studio</Text>
      </HStack>
      <Box>
        <Text textStyle="label/XS/medium" color="fg.muted" px="sm" py="xs">
          Project Planning
        </Text>
        <ListRow id="tickets" label="Tickets" icon={<SquareKanban />} variant="compact" />
        <ListRow id="timeline" label="Project Timeline" icon={<ChartNoAxesGantt />} variant="compact" isSelected />
        <AutoBuildActivity
          enabled={enabled}
          paused={paused}
          open={open}
          failed={false}
          running={enabled ? 2 : 0}
          capacity={2}
          supervisor={{
            id: "demo-supervisor",
            title: "Build the project",
            status: enabled ? "in_progress" : "completed",
          }}
          sessions={
            enabled
              ? [
                  { id: "demo-1", title: "DEMO-1 · Define project structure", status: "in_progress" },
                  { id: "demo-2", title: "DEMO-5 · Update the user guide", status: "in_progress" },
                ]
              : []
          }
          matchingTicketCount={5}
          readyTicketCount={2}
          onOpenChange={setOpen}
          onPause={async () => {
            setEnabled(false);
            setPaused(true);
            return true;
          }}
          onResume={async () => {
            setEnabled(true);
            setPaused(false);
            return true;
          }}
          onStop={() => {
            setEnabled(false);
            setPaused(false);
          }}
          onConfigure={() => {
            void installPrismGlobal().then(() => {
              setOpen(false);
              setConfiguration(true);
            });
          }}
          onOpenRequests={() => {}}
          onOpenSession={(session) => setSession(session.title)}
          t={t}
          trigger={
            <ListRow
              id="auto-build"
              role="button"
              tabIndex={0}
              aria-label="Auto Build"
              label="Auto Build"
              variant="compact"
              icon={enabled ? <AutoBuildIndicator status="in_progress" label="Auto Build running" /> : <Play />}
              endContent={enabled ? "2/2" : undefined}
            />
          }
        />
      </Box>
      {session ? (
        <Text role="status" textStyle="label/XS/regular" color="fg.muted" px="sm">
          Preview session: {session}
        </Text>
      ) : null}
      <Dialog.Root
        open={configuration}
        onOpenChange={({ open }) => setConfiguration(open)}
        size="lg"
        scrollBehavior="inside"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Auto Build</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <AutoBuildForm
                {...autoBuildStoryConfiguration}
                onClose={() => setConfiguration(false)}
                onEnable={async () => {
                  setEnabled(true);
                  setPaused(false);
                  setConfiguration(false);
                  setOpen(true);
                  return true;
                }}
                t={t}
              />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  );
}
