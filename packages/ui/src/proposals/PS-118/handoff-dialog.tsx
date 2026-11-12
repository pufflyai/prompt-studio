import { Badge, Button, CloseButton, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { MarkdownEditor } from "@/components/rich-text/markdown-editor/markdown-editor";
import { ScopedDialog as Dialog } from "@/utils/scoped-overlays";
import { Portal } from "@/utils/ui-scope";
import type { ResourceActivityController } from "./use-resource-activity";

interface ControllerProps {
  controller: ResourceActivityController;
}

export function HandoffDialog({ controller }: ControllerProps) {
  return (
    <Dialog.Root
      size="md"
      open={controller.confirmation}
      finalFocusEl={() => document.querySelector<HTMLElement>("[data-activity-composer] input")}
      onOpenChange={({ open }) => controller.setConfirmation(open)}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Start an agent session?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="md">
                <Badge variant="chip" alignSelf="start">
                  @{controller.draft?.target?.handle}
                </Badge>
                <Text textStyle="paragraph/S/regular">
                  The agent receives this resource and the complete discussion. It can use tools and may incur usage
                  costs.
                </Text>
                <Text textStyle="label/S/medium">{controller.resource.label}</Text>
                {controller.draft?.quote && (
                  <Text textStyle="paragraph/S/regular" color="fg.muted">
                    “{controller.draft.quote}”
                  </Text>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => controller.setConfirmation(false)}>
                Back to comment
              </Button>
              <Button variant="primary" onClick={controller.saveDraft}>
                Start session
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export function SessionPreview({ controller }: ControllerProps) {
  return (
    <Dialog.Root
      size="xl"
      open={Boolean(controller.session)}
      onOpenChange={({ open }) => {
        if (!open) controller.setSession(undefined);
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Stack gap="xs">
                <Dialog.Title>Activity session · {controller.session?.label}</Dialog.Title>
                <Badge variant="chip" alignSelf="start">
                  Prototype · simulated session
                </Badge>
              </Stack>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <ScrollArea maxH="harness-menu">
                <MarkdownEditor
                  key={controller.session?.id}
                  defaultState={`${controller.session?.thread ?? ""}\n\n---\n\n${controller.session?.body ?? ""}`}
                  scrollable={false}
                  padding="0"
                />
              </ScrollArea>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => controller.setSession(undefined)}>Back to resource</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export function ChangePreview({ controller }: ControllerProps) {
  return (
    <Dialog.Root
      size="xl"
      open={Boolean(controller.change)}
      onOpenChange={({ open }) => {
        if (!open) controller.setChange(undefined);
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Description change</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <ScrollArea maxH="harness-menu">
                <Stack gap="lg">
                  <Text textStyle="label/M/medium">Before</Text>
                  <MarkdownEditor
                    key={`before-${controller.change?.before}`}
                    defaultState={controller.change?.before ?? ""}
                    scrollable={false}
                    padding="0"
                  />
                  <Text textStyle="label/M/medium">After</Text>
                  <MarkdownEditor
                    key={`after-${controller.change?.after}`}
                    defaultState={controller.change?.after ?? ""}
                    scrollable={false}
                    padding="0"
                  />
                </Stack>
              </ScrollArea>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => controller.setChange(undefined)}>Back to activity</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
