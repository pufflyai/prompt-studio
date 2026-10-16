import { Avatar, Box, Editable, HStack, ProgressCircle, Stack, Tag, Text } from "@chakra-ui/react";
import { CopyButton, Header, ResourceBadge, ScrollArea, WorkspaceBadge } from "@pstdio/ui";
import { ChatInput, createSerializedPromptState } from "@pstdio/ui/chat-ui";
import { DataTable } from "@pstdio/ui/data-table";
import { useState } from "react";
import { GallerySection } from "./gallery-section";

const emptyPrompt = createSerializedPromptState();

export function ComposedComponents() {
  const [sent, setSent] = useState("");
  return (
    <GallerySection title="Composed components and auxiliary controls">
      <Header variant="narrow">
        <Text>Panel header</Text>
        <CopyButton text="Theme comparison" label="Copy title" size="xs" />
      </Header>
      <HStack flexWrap="wrap">
        <Avatar.Root size="xs">
          <Avatar.Fallback name="Theme Reviewer" />
        </Avatar.Root>
        <ResourceBadge fileName="theme.json" size="sm" />
        <WorkspaceBadge workspaceType="folder" label="Workspace" />
        <Tag.Root size="sm">
          <Tag.Label>Tag</Tag.Label>
        </Tag.Root>
        <ProgressCircle.Root value={60} size="xs">
          <ProgressCircle.Circle>
            <ProgressCircle.Track />
            <ProgressCircle.Range />
          </ProgressCircle.Circle>
        </ProgressCircle.Root>
      </HStack>
      <Editable.Root defaultValue="Click to rename" activationMode="click" aria-label="Editable name">
        <Editable.Preview />
        <Editable.Input />
      </Editable.Root>
      <ScrollArea height="24" borderWidth="1px" borderColor="border.subtle">
        <Stack gap="xs" p="xs">
          {Array.from({ length: 8 }, (_, index) => (
            <Text key={index}>Scrollable item {index + 1}</Text>
          ))}
        </Stack>
      </ScrollArea>
      <Box height="xs" minW="0">
        <DataTable
          data={[
            { Resource: "Theme audit", Status: "Ready" },
            { Resource: "Component review", Status: "In progress" },
          ]}
          selectionMode="multiple"
        />
      </Box>
      <Box bg="bg.muted" p="2xs" borderRadius="xs">
        <ChatInput defaultState={emptyPrompt} placeholder="Write a message" onSubmit={(text) => setSent(text)} />
      </Box>
      {sent && <Text textStyle="label/S/regular">Sent: {sent}</Text>}
    </GallerySection>
  );
}
