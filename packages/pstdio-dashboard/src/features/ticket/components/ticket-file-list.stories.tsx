import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ApiTicketFilesResponse } from "@/features/ticket-list/data/api";
import { ticketFileKeys } from "../hooks/use-ticket-files";
import { TicketFileList } from "./ticket-file-list";

const TICKET_ID = "ticket-story";

const createTicketFileQueryClient = (data: ApiTicketFilesResponse) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });

  queryClient.setQueryData(ticketFileKeys.byTicket(TICKET_ID), data);

  return queryClient;
};

interface TicketFileListStoryProps {
  data: ApiTicketFilesResponse;
}

const TicketFileListStory = (props: TicketFileListStoryProps) => {
  const { data } = props;
  const [queryClient] = useState(() => createTicketFileQueryClient(data));

  return (
    <Box maxW="360px" p="sm">
      <QueryClientProvider client={queryClient}>
        <TicketFileList ticketId={TICKET_ID} />
      </QueryClientProvider>
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
