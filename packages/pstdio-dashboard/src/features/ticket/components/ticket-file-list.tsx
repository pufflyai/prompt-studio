import { Menu, Stack } from "@chakra-ui/react";
import { ItemSection, MenuItem } from "@pstdio/ui";
import { FileCode, FileImage, FileJson, FileSpreadsheet, FileText } from "lucide-react";
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

const getTicketFileIcon = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (["csv", "tsv", "xlsx", "xls"].includes(extension)) return FileSpreadsheet;
  if (["ts", "tsx", "js", "jsx", "json", "py", "rb", "rs", "go", "java", "css", "scss", "html"].includes(extension)) {
    return extension === "json" ? FileJson : FileCode;
  }
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(extension)) return FileImage;
  return FileText;
};

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
            leftIcon={FileText}
            isSelected={selectedFile.id === TICKET_CONTENT_ITEM_ID}
            onClick={() => onSelect(TICKET_CONTENT_ITEM_ID)}
          />
          {files.map((file) => (
            <MenuItem
              key={file.id}
              primaryLabel={file.label}
              leftIcon={getTicketFileIcon(file.fileName)}
              isSelected={selectedFile.id === file.id}
              onClick={() => onSelect(file.id)}
            />
          ))}
        </Stack>
      </Menu.Root>
    </ItemSection>
  );
};
