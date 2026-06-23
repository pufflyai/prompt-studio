import { Box } from "@chakra-ui/react";
import { ChatPanel } from "@pstdio/ui/chat-ui";
import type { Meta, StoryObj } from "@storybook/react";
import type { SessionAttachment } from "pstdio-api-contracts";
import { useState } from "react";
import { SessionAttachmentControls } from "./session-attachment-controls";
import { SessionAttachmentList } from "./session-attachment-list";

const sampleAttachments: SessionAttachment[] = [
  {
    file_id: "file-notes",
    name: "release-notes.txt",
    mime_type: "text/plain",
    size_bytes: 2400,
    hash: "hash-notes",
    url: "/v1/projects/project/session-attachments/file-notes/content",
    created_at: "2026-06-17T10:00:00.000Z",
    updated_at: "2026-06-17T10:00:00.000Z",
  },
  {
    file_id: "file-diagram",
    name: "flow.png",
    mime_type: "image/png",
    size_bytes: 4096,
    hash: "hash-diagram",
    url: "/v1/projects/project/session-attachments/file-diagram/content",
    created_at: "2026-06-17T10:00:00.000Z",
    updated_at: "2026-06-17T10:00:00.000Z",
  },
];

const meta: Meta<typeof SessionAttachmentControls> = {
  title: "Modules/Sessions/Session Attachments",
  component: SessionAttachmentControls,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <Box maxW="560px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SessionAttachmentControls>;

const ControlsStory = (props: { initialAttachments?: SessionAttachment[]; uploading?: boolean }) => {
  const { initialAttachments = [], uploading = false } = props;
  const [attachments, setAttachments] = useState(initialAttachments);

  return (
    <>
      <SessionAttachmentList
        attachments={attachments}
        onRemove={(fileId) =>
          setAttachments((current) => current.filter((attachment) => attachment.file_id !== fileId))
        }
      />
      <SessionAttachmentControls
        projectId="project"
        uploading={uploading}
        onAttachFiles={(files) => {
          const uploaded = files.map((file) => ({
            file_id: crypto.randomUUID(),
            name: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
            hash: null,
            url: `/v1/projects/project/session-attachments/${crypto.randomUUID()}/content`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
          setAttachments((current) => [...current, ...uploaded]);
        }}
      />
    </>
  );
};

export const DraftAttachments: Story = {
  render: () => <ControlsStory initialAttachments={sampleAttachments} />,
};

export const Uploading: Story = {
  render: () => <ControlsStory initialAttachments={sampleAttachments.slice(0, 1)} uploading />,
};

export const SubmitErrorRecoverable: Story = {
  render: () => <ControlsStory initialAttachments={sampleAttachments} />,
};

export const SubmittedUserTurn: Story = {
  render: () => (
    <Box h="520px">
      <ChatPanel
        conversationKey="submitted-attachment-story"
        messages={[
          {
            id: "submitted-user",
            role: "user",
            parts: [
              { type: "text", text: "Use these attachments to review the release plan." },
              {
                type: "file",
                fileId: "file-notes",
                filename: "release-notes.txt",
                mediaType: "text/plain",
                size: 2400,
                url: "/v1/projects/project/session-attachments/file-notes/content",
              },
              {
                type: "file",
                fileId: "file-diagram",
                filename: "flow.png",
                mediaType: "image/png",
                size: 4096,
                url: "/v1/projects/project/session-attachments/file-diagram/content",
              },
            ],
          },
        ]}
        emptyStateTitle="No messages"
        emptyStateDescription="No messages"
        chatInputPlaceholder="Reply to the agent..."
        actions={<ControlsStory />}
      />
    </Box>
  ),
};
