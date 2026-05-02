import { Icon } from "@chakra-ui/react";
import { TreeList, type TreeListNavigateEvent, type TreeListSection } from "@pstdio/ui";
import { FileCode, FileImage, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
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

const FILES_SECTION_ID = "ticket-files";

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
  const [expandedSections, setExpandedSections] = useState<string[]>([FILES_SECTION_ID]);

  const files = buildSelectableTicketFiles(data);
  const selectedFile = resolveSelectedTicketFile(files, selectedFileId);

  if (files.length === 0) return null;

  const sections: TreeListSection[] = [
    {
      id: FILES_SECTION_ID,
      label: t("ticketDetail.files"),
      nodes: [
        {
          id: TICKET_CONTENT_ITEM_ID,
          label: t("ticketDetail.ticket"),
          icon: <Icon as={FileText} boxSize="16px" />,
          isNavigable: true,
          navigationIntent: { id: "select-file", payload: TICKET_CONTENT_ITEM_ID },
        },
        ...files.map((file) => ({
          id: file.id,
          label: file.label,
          icon: <Icon as={getTicketFileIcon(file.fileName)} boxSize="16px" />,
          isNavigable: true,
          navigationIntent: { id: "select-file", payload: file.id },
        })),
      ],
    },
  ];

  const handleNavigate = (event: TreeListNavigateEvent) => {
    if (event.intent?.id !== "select-file") return;
    onSelect(event.intent.payload as string);
  };

  const handleToggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  return (
    <TreeList
      sections={sections}
      activeNodeId={selectedFile.id}
      expandedSectionIds={expandedSections}
      rowVariant="compact"
      onNavigate={handleNavigate}
      onToggleSection={handleToggleSection}
    />
  );
};
