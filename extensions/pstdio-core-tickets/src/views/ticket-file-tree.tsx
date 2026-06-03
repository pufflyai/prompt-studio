import { Button, Flex, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

export interface TicketFileEntry {
  id: string;
  name: string;
}

interface FileRowProps {
  label: string;
  active: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

const FileRow = ({ label, active, onSelect, onDelete }: FileRowProps) => (
  <Flex
    role="group"
    align="center"
    gap="2xs"
    px="xs"
    py="1"
    rounded="sm"
    cursor="pointer"
    bg={active ? "bg.emphasized" : undefined}
    _hover={{ bg: active ? "bg.emphasized" : "bg.muted" }}
    onClick={onSelect}
  >
    <Text flex="1" minW="0" truncate textStyle="paragraph/S/regular">
      {label}
    </Text>
    {onDelete ? (
      <Button
        size="2xs"
        variant="ghost"
        colorPalette="red"
        opacity={0}
        _groupHover={{ opacity: 1 }}
        aria-label={`Delete ${label}`}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        ×
      </Button>
    ) : null}
  </Flex>
);

interface TicketFileTreeProps {
  bodyId: string;
  bodyLabel?: string;
  files: TicketFileEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}

export const TicketFileTree = (props: TicketFileTreeProps) => {
  const { bodyId, bodyLabel = "Ticket", files, selectedId, onSelect, onCreate, onDelete } = props;
  const [draftName, setDraftName] = useState<string | null>(null);

  const submit = () => {
    const trimmed = (draftName ?? "").trim();
    if (trimmed) onCreate(trimmed);
    setDraftName(null);
  };

  return (
    <Stack gap="2xs" p="sm" minW="0">
      <Flex align="center" justify="space-between" px="xs">
        <Text textStyle="paragraph/XS/medium" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
          Files
        </Text>
        <Button size="2xs" variant="ghost" aria-label="Add file" onClick={() => setDraftName("")}>
          +
        </Button>
      </Flex>

      <FileRow label={bodyLabel} active={selectedId === bodyId} onSelect={() => onSelect(bodyId)} />
      {files.map((file) => (
        <FileRow
          key={file.id}
          label={file.name}
          active={selectedId === file.id}
          onSelect={() => onSelect(file.id)}
          onDelete={() => onDelete(file.id)}
        />
      ))}

      {draftName !== null ? (
        <Input
          size="xs"
          autoFocus
          placeholder="file-name.md"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={submit}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
            if (event.key === "Escape") setDraftName(null);
          }}
        />
      ) : null}
    </Stack>
  );
};
