import { Button, Flex, Icon, Spinner, Stack, Text, Wrap } from "@chakra-ui/react";
import { CircleAlert, CircleCheck, Clock3, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AttachmentChip } from "@/components/overlays/attachment-chip";
import type { FileUploadValue } from "../param-editor.types";
import { ParamEditorControlItem } from "../param-editor-control-item";
import { createFileUploadValues, getFileUploadSummary } from "./file-upload-value";

interface FileUploadInputProps {
  id: string;
  name: string;
  description?: string;
  defaultValue: FileUploadValue[];
  accept?: string;
  multiple?: boolean;
  uploadLabel?: string;
  onChange: (id: string, value: FileUploadValue[]) => void;
  readOnly?: boolean;
  presentation?: "stacked" | "horizontal";
}

const UploadStatus = (props: { values: FileUploadValue[] }) => {
  const { values } = props;
  const summary = getFileUploadSummary(values);
  if (summary.state === "empty") return null;

  const noun = summary.count === 1 ? "file" : "files";
  const labels = {
    queued: `${summary.count.toString()} ${noun} queued`,
    uploading: `Uploading ${summary.count.toString()} ${noun}`,
    complete: `${summary.count.toString()} ${noun} uploaded`,
    error: `${summary.count.toString()} ${noun} failed`,
    empty: "",
  };
  const icon =
    summary.state === "uploading" ? (
      <Spinner boxSize="12px" borderWidth="1px" />
    ) : (
      <Icon
        as={summary.state === "error" ? CircleAlert : summary.state === "complete" ? CircleCheck : Clock3}
        boxSize="12px"
      />
    );

  return (
    <Flex alignItems="center" gap="2xs" color={summary.state === "error" ? "fg.error" : "fg.muted"}>
      {icon}
      <Text textStyle="label/XS/medium">{labels[summary.state]}</Text>
    </Flex>
  );
};

const UploadQueue = (props: { readOnly?: boolean; values: FileUploadValue[]; onRemove: (valueId: string) => void }) => {
  const { readOnly, values, onRemove } = props;
  if (values.length === 0) return null;

  return (
    <Stack gap="2xs" minW="0">
      <UploadStatus values={values} />
      <Wrap gap="2xs">
        {values.map((value) => (
          <AttachmentChip
            key={value.id}
            file={value.file}
            disabled={readOnly}
            removeLabel={`Remove ${value.file.name}`}
            onRemove={() => onRemove(value.id)}
          />
        ))}
      </Wrap>
    </Stack>
  );
};

export const FileUploadInput = (props: FileUploadInputProps) => {
  const {
    id,
    name,
    description,
    defaultValue,
    accept,
    multiple = true,
    uploadLabel = "Attach files",
    onChange,
    readOnly,
    presentation = "stacked",
  } = props;
  const [values, setValues] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValues(defaultValue);
  }, [defaultValue]);

  const commit = (next: FileUploadValue[]) => {
    setValues(next);
    onChange(id, next);
  };
  const remove = (valueId: string) => commit(values.filter((value) => value.id !== valueId));
  const button = readOnly ? null : (
    <Button size="xs" variant="ghost" flexShrink={0} onClick={() => inputRef.current?.click()}>
      <Icon as={Paperclip} boxSize="14px" />
      {uploadLabel}
    </Button>
  );
  const input = (
    <input
      ref={inputRef}
      hidden
      type="file"
      accept={accept}
      multiple={multiple}
      onChange={(event) => {
        commit(createFileUploadValues(Array.from(event.currentTarget.files ?? []), values, multiple));
        event.currentTarget.value = "";
      }}
    />
  );

  if (presentation === "horizontal") {
    return (
      <Flex alignItems="center" gap="sm" minW="0" width="full">
        {input}
        {button}
        <UploadQueue readOnly={readOnly} values={values} onRemove={remove} />
      </Flex>
    );
  }

  return (
    <ParamEditorControlItem name={name} description={description} orientation="stacked">
      <Stack alignItems="start" gap="xs" minW="0">
        {input}
        {button}
        <UploadQueue readOnly={readOnly} values={values} onRemove={remove} />
      </Stack>
    </ParamEditorControlItem>
  );
};
