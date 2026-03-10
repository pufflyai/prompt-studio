import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { seedCollection } from "@/features/sync/seed-collections";
import type { ApiTicketFilesResponse } from "@/features/ticket-list/data/api";
import { TicketFileList } from "./ticket-file-list";

const TICKET_ID = "ticket-story";

interface TicketFileListStoryProps {
  data: ApiTicketFilesResponse;
}

const TicketFileListStory = (props: TicketFileListStoryProps) => {
  const { data } = props;
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    seedCollection(
      "files",
      data.files.map((f) => ({
        id: f.id,
        file_name: f.file_name,
        file_kind: f.file_kind,
        mime_type: f.mime_type,
        size_bytes: f.size_bytes,
        created_at: f.created_at,
      })),
    );

    seedCollection(
      "ticket_files",
      data.files.map((f) => ({
        id: `tf-${f.id}`,
        ticket_id: TICKET_ID,
        file_id: f.id,
      })),
    );

    seedCollection(
      "workspace_artifacts",
      data.artifacts.map((a) => ({
        id: a.id,
        file_id: a.file_id,
        file_name: a.file_name,
        file_kind: a.file_kind,
        relative_path: a.relative_path,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
        created_at: a.created_at,
      })),
    );

    setSeeded(true);
  }, [data]);

  if (!seeded) return null;

  return (
    <Box maxW="360px" p="sm">
      <TicketFileList ticketId={TICKET_ID} />
    </Box>
  );
};

const meta: Meta = {
  title: "Ticket/TicketFileList",
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj;

export const ArtifactOnlyRendersNothing: Story = {
  render: () => (
    <TicketFileListStory
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
        ],
        artifacts: [
          {
            id: "artifact-log",
            file_id: "file-log",
            file_name: "build.log",
            file_kind: "artifact",
            relative_path: "artifacts/build.log",
            mime_type: "text/plain",
            size_bytes: 200,
            created_at: "2026-02-20T10:00:00.000Z",
          },
        ],
      }}
    />
  ),
};

export const IgnoresArtifactsAndShowsTicketFiles: Story = {
  render: () => (
    <TicketFileListStory
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
            id: "file-manual",
            file_name: "manual.txt",
            file_kind: "ticket-artifact",
            mime_type: "text/plain",
            size_bytes: 100,
            created_at: "2026-02-20T10:00:00.000Z",
          },
        ],
        artifacts: [
          {
            id: "artifact-schema",
            file_id: "file-schema",
            file_name: "schema.md",
            file_kind: "artifact",
            relative_path: "schema.md",
            mime_type: "text/markdown",
            size_bytes: 100,
            created_at: "2026-02-20T10:00:00.000Z",
          },
          {
            id: "artifact-lint",
            file_id: "file-lint",
            file_name: "lint.log",
            file_kind: "artifact",
            relative_path: "artifacts/lint.log",
            mime_type: "text/plain",
            size_bytes: 300,
            created_at: "2026-02-20T10:00:00.000Z",
          },
        ],
      }}
    />
  ),
};

export const ShowsTicketFilesAndSkipsArtifacts: Story = {
  render: () => (
    <TicketFileListStory
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
            id: "file-brief",
            file_name: "brief.md",
            file_kind: "ticket-artifact",
            mime_type: "text/markdown",
            size_bytes: 100,
            created_at: "2026-02-20T10:00:00.000Z",
          },
          {
            id: "file-log",
            file_name: "run.log",
            file_kind: "ticket-artifact",
            mime_type: "text/plain",
            size_bytes: 200,
            created_at: "2026-02-20T10:00:00.000Z",
          },
        ],
        artifacts: [
          {
            id: "artifact-build",
            file_id: "artifact-file-build",
            file_name: "build.log",
            file_kind: "artifact",
            relative_path: "artifacts/build.log",
            mime_type: "text/plain",
            size_bytes: 300,
            created_at: "2026-02-20T10:00:00.000Z",
          },
        ],
      }}
    />
  ),
};
