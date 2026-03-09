import { Stack } from "@chakra-ui/react";
import { ItemSection, MenuItem } from "@pstdio/ui";
import { useTranslation } from "react-i18next";
import type { ApiTicketFilesResponse } from "@/features/ticket-list/data/api";
import { useTicketFiles } from "../hooks/use-ticket-files";

interface TicketFileListProps {
  ticketId: string;
}

type TicketFileEntry = {
  id: string;
  fileName: string;
};

const TICKET_CONTENT_FILE = "ticket.md";

const stripExtension = (fileName: string) => {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
};

const buildTicketFileEntries = (data: ApiTicketFilesResponse | undefined) => {
  const fileEntries: TicketFileEntry[] = [];
  const seenFileIds = new Set<string>();

  for (const file of data?.files ?? []) {
    if (file.file_name === TICKET_CONTENT_FILE) continue;
    if (seenFileIds.has(file.id)) continue;

    seenFileIds.add(file.id);
    fileEntries.push({ id: file.id, fileName: file.file_name });
  }

  return fileEntries;
};

export const TicketFileList = (props: TicketFileListProps) => {
  const { ticketId } = props;
  const { t } = useTranslation("tickets");
  const { data } = useTicketFiles(ticketId);

  const files = buildTicketFileEntries(data);

  if (files.length === 0) return null;

  return (
    <ItemSection title={t("ticketDetail.files")} defaultOpen>
      <Stack gap="xs">
        {files.map((file) => (
          <MenuItem key={file.id} primaryLabel={stripExtension(file.fileName)} />
        ))}
      </Stack>
    </ItemSection>
  );
};
