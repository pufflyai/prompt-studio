import { Button, HStack, IconButton, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { pigeonStore } from "./pigeon-state";
import { useShowcaseStore } from "./showcase-store";

export const PigeonComposer = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const state = useShowcaseStore(pigeonStore);
  const close = () => input.workbench.overlays.closeOverlay(input.instance.instanceId);
  return (
    <Stack
      w={{ base: "calc(100vw - 2rem)", md: "xl" }}
      maxH="80dvh"
      bg="bg.panel"
      borderRadius="xl"
      overflow="hidden"
      boxShadow="2xl"
      gap="0"
    >
      <HStack px="md" py="sm" bg="bg.muted" justify="space-between">
        <Text textStyle="paragraph/S/semibold">New message</Text>
        <IconButton aria-label="Close composer" size="xs" variant="ghost" onClick={close}>
          <WorkbenchIcon name="X" />
        </IconButton>
      </HStack>
      <Stack p="md" gap="sm">
        <Input
          aria-label="To"
          variant="flushed"
          placeholder="To"
          value={state.draft.to}
          onChange={(event) => pigeonStore.setState({ draft: { ...state.draft, to: event.target.value } })}
        />
        <Input
          aria-label="Subject"
          variant="flushed"
          placeholder="Subject"
          value={state.draft.subject}
          onChange={(event) => pigeonStore.setState({ draft: { ...state.draft, subject: event.target.value } })}
        />
        <Textarea
          aria-label="Message body"
          minH="48"
          border="0"
          resize="none"
          placeholder="Write a message"
          value={state.draft.body}
          onChange={(event) => pigeonStore.setState({ draft: { ...state.draft, body: event.target.value } })}
        />
        <HStack justify="space-between">
          <Button onClick={close}>
            <WorkbenchIcon name="Send" />
            Send
          </Button>
          <IconButton
            aria-label="Discard draft"
            variant="ghost"
            onClick={() => {
              pigeonStore.setState({ draft: { to: "", subject: "", body: "" } });
              close();
            }}
          >
            <WorkbenchIcon name="Trash2" />
          </IconButton>
        </HStack>
      </Stack>
    </Stack>
  );
};
