import { Box, Button, Flex, Icon, Text } from "@chakra-ui/react";
import { Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FileDropValue } from "../param-editor.types";
import { ParamEditorControlItem } from "../param-editor-control-item";
import { acceptsFile, fileDropValueFromFile } from "./file-accept";

interface FileDropInputProps {
  id: string;
  name: string;
  description?: string;
  defaultValue: FileDropValue | null;
  accept?: string;
  assetKind?: "file" | "image";
  onChange: (id: string, value: FileDropValue | null) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

const formatSize = (size?: number) => {
  if (!size) return undefined;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const FileDropInput = (props: FileDropInputProps) => {
  const { id, name, description, defaultValue, accept, assetKind = "file", onChange, readOnly } = props;
  const [value, setValue] = useState<FileDropValue | null>(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const ingest = (file: File | undefined) => {
    if (!file) return;
    if (!acceptsFile({ name: file.name, mimeType: file.type }, accept)) {
      setError(`${file.name} is not an accepted ${assetKind}`);
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : undefined;
      const next = fileDropValueFromFile({ name: file.name, type: file.type, size: file.size, dataUrl });
      setValue(next);
      onChange(id, next);
    };
    reader.readAsDataURL(file);
  };

  const clear = () => {
    setValue(null);
    setError(null);
    onChange(id, null);
  };

  const selected = value ? (
    <Flex alignItems="center" justifyContent="space-between" gap="xs" minW="0" width="full">
      <Flex alignItems="center" gap="xs" minW="0">
        {assetKind === "image" && value.dataUrl ? (
          <Box boxSize="1.75rem" borderRadius="xs" bgImage={`url(${value.dataUrl})`} bgSize="cover" flexShrink={0} />
        ) : null}
        <Box minW="0">
          <Text textStyle="label/S/medium" color="fg" truncate>
            {value.name}
          </Text>
          {formatSize(value.size) ? (
            <Text textStyle="label/XS/regular" color="fg.muted">
              {formatSize(value.size)}
            </Text>
          ) : null}
        </Box>
      </Flex>
      {readOnly ? null : (
        <Button size="2xs" variant="ghost" onClick={clear}>
          <X />
        </Button>
      )}
    </Flex>
  ) : null;

  const dropZone = (
    <Box
      borderWidth="1px"
      borderStyle="dashed"
      borderColor={error ? "border.error" : dragging ? "border.accent-light" : "border"}
      borderRadius="sm"
      bg={dragging ? "bg.muted" : "bg"}
      px="sm"
      py="md"
      cursor={readOnly ? "default" : "pointer"}
      transition="border-color 0.2s ease-in-out"
      boxShadow="none"
      _hover={{ borderColor: error ? "border.error" : "border.accent-light" }}
      _active={{ borderColor: error ? "border.error" : "border.accent-light" }}
      _focusWithin={{ borderColor: error ? "border.error" : "border.accent-light", boxShadow: "none" }}
      onClick={() => {
        if (!readOnly) inputRef.current?.click();
      }}
      onDragOver={(event) => {
        if (readOnly) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        if (readOnly) return;
        event.preventDefault();
        setDragging(false);
        ingest(event.dataTransfer.files[0]);
      }}
    >
      <Flex direction="column" alignItems="center" gap="2xs" color="fg.muted">
        <Icon as={Upload} boxSize="16px" />
        <Text textStyle="label/XS/regular">Drop {assetKind} or click to browse</Text>
      </Flex>
    </Box>
  );

  return (
    <ParamEditorControlItem name={name} description={description} orientation="stacked">
      <input ref={inputRef} type="file" accept={accept} hidden onChange={(event) => ingest(event.target.files?.[0])} />
      {value ? selected : dropZone}
      {error ? (
        <Text textStyle="label/XS/regular" color="fg.error" mt="2xs">
          {error}
        </Text>
      ) : null}
    </ParamEditorControlItem>
  );
};
