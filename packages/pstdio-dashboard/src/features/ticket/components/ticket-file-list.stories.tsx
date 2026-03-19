import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ApiTicketFilesResponse } from "@/features/ticket-list/data/api";
import { TicketFileList } from "./ticket-file-list";

interface TicketFileListStoryProps {
  data: ApiTicketFilesResponse;
  selectedFileId: string;
}

const TicketFileListStory = (props: TicketFileListStoryProps) => {
  const { data, selectedFileId } = props;

  return (
    <Box maxW="360px" p="sm">
      <TicketFileList data={data} selectedFileId={selectedFileId} onSelect={() => undefined} />
    </Box>
  );
};

const meta: Meta = {
  title: "Ticket/TicketFileList",
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj;

const filesData: ApiTicketFilesResponse = {
  files: [
    {
      id: "file-ticket",
      file_name: "ticket.md",
      file_kind: "ticket",
      mime_type: "text/markdown",
      size_bytes: 10,
      created_at: "2026-02-20T10:00:00.000Z",
    },
    {
      id: "file-brief",
      file_name: "brief.md",
      file_kind: "ticket-artifact",
      mime_type: "text/markdown",
      size_bytes: 100,
      created_at: "2026-02-20T10:00:00.000Z",
    },
    {
      id: "file-manual",
      file_name: "manual.txt",
      file_kind: "ticket-artifact",
      mime_type: "text/plain",
      size_bytes: 100,
      created_at: "2026-02-20T10:00:00.000Z",
    },
    {
      id: "file-log",
      file_name: "run.log",
      file_kind: "artifact",
      mime_type: "text/plain",
      size_bytes: 200,
      created_at: "2026-02-20T10:00:00.000Z",
    },
  ],
  artifacts: [
    {
      id: "artifact-build",
      file_id: "file-log",
      file_name: "build.log",
      file_kind: "artifact",
      relative_path: "artifacts/build.log",
      mime_type: "text/plain",
      size_bytes: 300,
      created_at: "2026-02-20T10:00:00.000Z",
    },
  ],
};

export const TicketSelected: Story = {
  render: () => <TicketFileListStory data={filesData} selectedFileId="ticket" />,
};

export const AttachmentSelected: Story = {
  render: () => <TicketFileListStory data={filesData} selectedFileId="file-manual" />,
};

export const ArtifactOnlyRendersNothing: Story = {
  render: () => (
    <TicketFileListStory
      selectedFileId="ticket"
      data={{
        files: [
          {
            id: "file-ticket",
            file_name: "ticket.md",
            file_kind: "ticket",
            mime_type: "text/markdown",
            size_bytes: 10,
            created_at: "2026-02-20T10:00:00.000Z",
          },
          {
            id: "build-log",
            file_name: "build.log",
            file_kind: "artifact",
            mime_type: "text/plain",
            size_bytes: 200,
            created_at: "2026-02-20T10:00:00.000Z",
          },
        ],
        artifacts: [],
      }}
    />
  ),
};
