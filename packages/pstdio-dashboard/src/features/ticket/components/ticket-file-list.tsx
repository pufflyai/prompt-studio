import { Menu, Stack } from "@chakra-ui/react";
import { ItemSection, MenuItem } from "@pstdio/ui";
import { useTranslation } from "react-i18next";
import type { ApiTicketFilesResponse } from "@/features/ticket-list/data/api";
import {
  buildSelectableTicketFiles,
  resolveSelectedTicketFile,
  TICKET_CONTENT_ITEM_ID,
} from "../utils/ticket-file-selection";

interface TicketFileListProps {
  data: ApiTicketFilesResponse | undefined;
  selectedFileId: string;
  onSelect: (fileId: string) => void;
}

export const TicketFileList = (props: TicketFileListProps) => {
  const { data, selectedFileId, onSelect } = props;
  const { t } = useTranslation("tickets");

  const files = buildSelectableTicketFiles(data);
  const selectedFile = resolveSelectedTicketFile(files, selectedFileId);

  if (files.length === 0) return null;

  return (
    <ItemSection title={t("ticketDetail.files")} defaultOpen>
      <Menu.Root>
        <Stack gap="xs">
          <MenuItem
            primaryLabel={t("ticketDetail.ticket")}
            isSelected={selectedFile.id === TICKET_CONTENT_ITEM_ID}
            onClick={() => onSelect(TICKET_CONTENT_ITEM_ID)}
          />
          {files.map((file) => (
            <MenuItem
              key={file.id}
              primaryLabel={file.label}
              isSelected={selectedFile.id === file.id}
              onClick={() => onSelect(file.id)}
            />
          ))}
        </Stack>
      </Menu.Root>
    </ItemSection>
  );
};
