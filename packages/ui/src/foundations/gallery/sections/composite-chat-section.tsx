import { Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { ArrowUpRight, ChevronDown, GitBranch } from "lucide-react";
import { ChatPanel, ChatWorkspaceHub, type SessionMessage } from "@/components/chat-ui";
import { RichMessage } from "@/components/rich-text";
import { GalleryCard } from "../gallery-frame";

const markdownPreview = `# Release note

The validation pass is ready for review.

- Inputs now share the same hover and active border treatment.
- Toasts, alerts, tabs, menus, and badges use the foundation recipes.
- Composite examples cover full product surfaces.

| Area | Status |
| ---- | ------ |
| Theme recipes | Ready |
| Storybook | Ready |
| Browser check | Ready |

\`\`\`ts
const defaultButtonSize = "sm";
const denseRowButtonSize = "xs";
\`\`\``;

const chatMessages: SessionMessage[] = [
  {
    id: "gallery-user-1",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Review the release note and call out any UI package risks before I publish.",
      },
    ],
  },
  {
    id: "gallery-assistant-1",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: [
          "The release note is ready. The main risk is visual drift in dense primitives, so I checked the gallery stories that combine menus, tabs, badges, and chat.",
          "",
          "- Menu rows now match row-item density.",
          "- Badges use an explicit pill radius.",
          "- Active tabs have a visible selected surface.",
        ].join("\n"),
      },
      {
        type: "tool",
        tool: "storybook-check",
        actionType: "other",
        status: "completed",
        state: {
          status: "completed",
          input: { story: "Foundations/Component Gallery" },
          output: "Computed styles matched the expected recipe tokens.",
        },
      },
    ],
  },
  {
    id: "gallery-user-2",
    role: "user",
    parts: [{ type: "text", text: "Add the notes to the package handoff." }],
  },
  {
    id: "gallery-assistant-2",
    role: "assistant",
    parts: [{ type: "text", text: "Done. I attached the handoff summary and kept the open workspace diff visible." }],
  },
];

const chatActions = (
  <HStack gap="xs">
    <Button size="xs" variant="outline">
      Codex
    </Button>
    <Button size="xs" variant="ghost">
      Review
    </Button>
  </HStack>
);

const workspaceHub = (
  <ChatWorkspaceHub
    workspaceControl={
      <Button size="xs" variant="ghost" px="2xs">
        <GitBranch size={14} />
        <Text textStyle="label/XS/medium" color="fg" ml="2xs">
          main
        </Text>
        <ChevronDown size={14} />
      </Button>
    }
    additions={12}
    deletions={3}
    action={
      <IconButton size="xs" variant="ghost" aria-label="Open workspace">
        <ArrowUpRight size={14} />
      </IconButton>
    }
  />
);

export const CompositeChatSection = () => {
  return (
    <>
      <GalleryCard title="Markdown renderer" names={["RichMessage"]} gridColumn={{ base: "auto", xl: "span 2" }}>
        <Box minW="0" borderWidth="1px" borderColor="border.subtle" borderRadius="xs" bg="bg" p="sm">
          <RichMessage defaultState={markdownPreview} fullWidth />
        </Box>
      </GalleryCard>

      <GalleryCard
        title="Full chat UI"
        names={["ChatPanel", "ChatWorkspaceHub"]}
        gridColumn={{ base: "auto", xl: "span 2" }}
      >
        <Stack
          h="34rem"
          minW="0"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="xs"
          bg="bg"
          overflow="hidden"
        >
          <ChatPanel
            conversationKey="component-gallery-chat"
            messages={chatMessages}
            emptyStateTitle="No session selected"
            emptyStateDescription="Start a session to review package changes."
            chatInputPlaceholder="Ask about this release..."
            chatInputDefaultValue="Summarize the remaining risks"
            actions={chatActions}
            workspaceHub={workspaceHub}
            attachedResources={["packages/ui/src/theme/recipes/tabs.ts"]}
            onSubmitMessage={() => undefined}
            onClearAttachments={() => undefined}
          />
        </Stack>
      </GalleryCard>
    </>
  );
};
