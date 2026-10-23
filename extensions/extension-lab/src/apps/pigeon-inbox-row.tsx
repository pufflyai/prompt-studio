import { HStack, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { useExampleStore } from "../example-store";
import { ExampleIcon } from "../icon";
import type { PigeonThread } from "./pigeon-data";
import { pigeonStore } from "./pigeon-state";

interface PigeonInboxRowProps {
  thread: PigeonThread;
  selected: boolean;
  onOpen(): void;
}
export const PigeonInboxRow = (props: PigeonInboxRowProps) => {
  const { thread, selected, onOpen } = props;
  const state = useExampleStore(pigeonStore);
  const starred = state.starredIds.includes(thread.id);
  return (
    <ListRow
      id={thread.id}
      variant="collection"
      role="listitem"
      aria-label={`Open message: ${thread.subject}`}
      isSelected={selected}
      icon={<ExampleIcon name={thread.unread ? "Mail" : "MailOpen"} color={thread.unread ? "fg" : "fg.muted"} />}
      label={
        <HStack gap="md" minW="0">
          <Text
            w="40"
            flexShrink={0}
            truncate
            textStyle={thread.unread ? "paragraph/S/semibold" : "paragraph/S/regular"}
          >
            {thread.sender}
          </Text>
          <Text truncate textStyle={thread.unread ? "paragraph/S/semibold" : "paragraph/S/regular"}>
            {thread.subject}
          </Text>
          <Text truncate flex="1" color="fg.muted" textStyle="paragraph/S/regular">
            {thread.preview}
          </Text>
        </HStack>
      }
      endContent={
        <Text color="fg.muted" textStyle="paragraph/XS/regular" whiteSpace="nowrap">
          {thread.time}
        </Text>
      }
      onActivate={onOpen}
      actions={[
        {
          id: "star",
          label: starred ? `Unstar ${thread.subject}` : `Star ${thread.subject}`,
          icon: <ExampleIcon name="Star" color={starred ? "fg.warning" : "fg.muted"} />,
          onAction: () =>
            pigeonStore.setState({
              starredIds: starred
                ? state.starredIds.filter((id) => id !== thread.id)
                : [...state.starredIds, thread.id],
            }),
        },
      ]}
    />
  );
};
