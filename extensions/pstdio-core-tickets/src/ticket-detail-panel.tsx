import { Badge, Button, Center, Flex, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { AlertMessage, EmptyState, Header, installPrismGlobal, ScrollArea } from "@pstdio/ui";
import { FileText, RotateCcw, Save } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { TicketDataRow } from "./ticket-data";
import { readTicketDocument, updateTicketDocumentFile } from "./ticket-panel-api";
import type { TicketDocumentFile, TicketDocumentProperty, TicketDocumentReadModel } from "./ticket-panel-types";

interface TicketDetailPanelProps {
  host: GuestHost;
  ticket?: TicketDataRow;
}

interface TicketDocumentState {
  model: TicketDocumentReadModel;
  savedContentByFileId: Record<string, string>;
  draftContentByFileId: Record<string, string>;
}

const toContentByFileId = (files: TicketDocumentFile[]) =>
  Object.fromEntries(files.map((file) => [file.id, file.content]));

const MarkdownEditor = lazy(async () => {
  await installPrismGlobal();
  const module = await import("@pstdio/ui/rich-text");
  return { default: module.MarkdownEditor };
});

const propertyValue = (property: TicketDocumentProperty) =>
  property.value === undefined || property.value === null || property.value === "" ? "None" : String(property.value);

const TicketFileTabs = (props: {
  activeFileId?: string;
  files: TicketDocumentFile[];
  onSelectFile: (fileId: string) => void;
}) => {
  const { activeFileId, files, onSelectFile } = props;

  return (
    <HStack px="sm" py="xs" gap="xs" borderBottomWidth="1px" overflowX="auto">
      {files.map((file) => (
        <Button
          key={file.id}
          size="xs"
          variant={file.id === activeFileId ? "subtle" : "ghost"}
          flexShrink="0"
          onClick={() => onSelectFile(file.id)}
        >
          <FileText size={14} />
          {file.name}
        </Button>
      ))}
    </HStack>
  );
};

const TicketProperties = (props: { properties: TicketDocumentProperty[] }) => {
  const { properties } = props;
  if (properties.length === 0) return null;

  return (
    <HStack gap="2xs" flexWrap="wrap">
      {properties.map((property) => (
        <Badge key={property.id} variant="subtle" colorPalette="gray" textStyle="label/XS/medium">
          {property.label}: {propertyValue(property)}
        </Badge>
      ))}
    </HStack>
  );
};

export const TicketDetailPanel = (props: TicketDetailPanelProps) => {
  const { host, ticket } = props;
  const ticketRef = ticket?.attributes.shorthand;
  const [documentState, setDocumentState] = useState<TicketDocumentState | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | undefined>();
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const hasEditorInitialized = useRef(false);

  useEffect(() => {
    if (!ticketRef) {
      setDocumentState(null);
      setActiveFileId(undefined);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);
    hasEditorInitialized.current = false;

    void readTicketDocument(host, ticketRef)
      .then((model) => {
        if (cancelled) return;
        const contentByFileId = toContentByFileId(model.files);
        setDocumentState({
          model,
          savedContentByFileId: contentByFileId,
          draftContentByFileId: contentByFileId,
        });
        setActiveFileId(model.activeFileId ?? model.files[0]?.id);
        setEditorKey((key) => key + 1);
        setStatus("ready");
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : String(caught));
        setDocumentState(null);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [host, ticketRef]);

  const files = documentState?.model.files ?? [];
  const activeFile = files.find((file) => file.id === activeFileId);
  const activeDraft = activeFile ? (documentState?.draftContentByFileId[activeFile.id] ?? "") : "";
  const activeSaved = activeFile ? (documentState?.savedContentByFileId[activeFile.id] ?? "") : "";
  const isDirty = activeDraft !== activeSaved;
  const canEdit = activeFile?.editable !== false;
  const isSaveDisabled = !ticketRef || !activeFile || !canEdit || !isDirty || saving;

  const handleContentChange = (value: string) => {
    if (!activeFile) return;
    if (!hasEditorInitialized.current) {
      hasEditorInitialized.current = true;
      return;
    }
    setDocumentState((current) => {
      if (!current) return current;
      return {
        ...current,
        draftContentByFileId: { ...current.draftContentByFileId, [activeFile.id]: value },
      };
    });
  };

  const handleSelectFile = (fileId: string) => {
    hasEditorInitialized.current = false;
    setActiveFileId(fileId);
    setEditorKey((key) => key + 1);
  };

  const handleReset = () => {
    if (!activeFile) return;
    hasEditorInitialized.current = false;
    setDocumentState((current) => {
      if (!current) return current;
      return {
        ...current,
        draftContentByFileId: {
          ...current.draftContentByFileId,
          [activeFile.id]: current.savedContentByFileId[activeFile.id] ?? "",
        },
      };
    });
    setEditorKey((key) => key + 1);
  };

  const handleSave = async () => {
    if (!ticketRef || !activeFile || isSaveDisabled) return;
    setSaving(true);
    setError(null);
    try {
      await updateTicketDocumentFile(host, { ticket: ticketRef, fileId: activeFile.id, content: activeDraft });
      setDocumentState((current) => {
        if (!current) return current;
        return {
          ...current,
          savedContentByFileId: { ...current.savedContentByFileId, [activeFile.id]: activeDraft },
        };
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  if (!ticketRef) {
    return (
      <Flex h="full" w="full" p="md" bg="bg">
        <EmptyState title="Select a ticket" description="Open a ticket to view and edit its files." height="100%" />
      </Flex>
    );
  }

  return (
    <Flex direction="column" h="full" w="full" minH="0" minW="0" bg="bg" color="fg">
      <Header borderBottomWidth="1px" gap="sm" px="sm">
        <Stack gap="2xs" flex="1" minW="0">
          <Text textStyle="heading/S" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            {documentState?.model.title ?? ticket.title}
          </Text>
          <TicketProperties properties={documentState?.model.properties ?? []} />
        </Stack>
        <HStack gap="xs">
          <Button size="xs" variant="ghost" disabled={!isDirty || saving} onClick={handleReset}>
            <RotateCcw size={14} />
            Reset
          </Button>
          <Button
            size="xs"
            variant="primary"
            loading={saving}
            disabled={isSaveDisabled}
            onClick={() => void handleSave()}
          >
            <Save size={14} />
            Save
          </Button>
        </HStack>
      </Header>

      {error ? (
        <AlertMessage status="error" colorPalette="red" title="Ticket details failed" size="sm" m="sm">
          {error}
        </AlertMessage>
      ) : null}

      {status === "loading" ? (
        <Center flex="1" color="fg.muted">
          <Spinner size="sm" />
        </Center>
      ) : null}

      {status === "ready" ? (
        <>
          <TicketFileTabs files={files} activeFileId={activeFileId} onSelectFile={handleSelectFile} />
          <ScrollArea flex="1" minH="0" contentProps={{ p: "sm" }}>
            {activeFile ? (
              <Suspense
                fallback={
                  <Center minH="12rem" color="fg.muted">
                    <Spinner size="sm" />
                  </Center>
                }
              >
                <MarkdownEditor
                  key={`${ticketRef}:${activeFile.id}:${editorKey}`}
                  defaultState={activeDraft}
                  isEditable={canEdit}
                  placeholder="Enter ticket content..."
                  onChange={handleContentChange}
                />
              </Suspense>
            ) : (
              <EmptyState
                title="No files found"
                description="This ticket does not have editable files."
                height="12rem"
              />
            )}
          </ScrollArea>
        </>
      ) : null}
    </Flex>
  );
};
