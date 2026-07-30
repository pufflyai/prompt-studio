import type { FileUploadValue } from "../param-editor.types";

export type FileUploadSummaryState = "empty" | "queued" | "uploading" | "complete" | "error";

const valueId = (file: File, index: number) =>
  `${file.name}-${file.size.toString()}-${file.lastModified.toString()}-${index.toString()}`;

export const createFileUploadValues = (
  files: File[],
  existing: FileUploadValue[],
  multiple: boolean,
): FileUploadValue[] => {
  const offset = multiple ? existing.length : 0;
  const selected = files.map((file, index) => ({
    id: valueId(file, offset + index),
    file,
    status: "queued" as const,
  }));

  return multiple ? [...existing, ...selected] : selected.slice(0, 1);
};

export const getFileUploadSummary = (values: FileUploadValue[]) => {
  const states: FileUploadSummaryState[] = ["uploading", "error", "queued", "complete"];
  const state = states.find((candidate) => values.some((value) => value.status === candidate)) ?? "empty";
  const count = state === "empty" ? 0 : values.filter((value) => value.status === state).length;

  return { state, count };
};
