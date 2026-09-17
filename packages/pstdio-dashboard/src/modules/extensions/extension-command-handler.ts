import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import {
  type CommandFilesParamValue,
  createCommandFilesParamValue,
  isCommandFilesParamValue,
} from "@pstdio/workbench/react";

export type ExecuteDashboardExtensionCommand = (
  projectId: string,
  commandId: string,
  body: unknown,
) => Promise<CommandExecuteResponse>;

export type UploadDashboardExtensionCommandFile = (
  projectId: string,
  commandId: string,
  file: File,
) => Promise<{ id: string }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const uploadErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "File upload failed.");

const prepareFilesValue = async (input: {
  commandId: string;
  files: CommandFilesParamValue;
  onChange: (files: CommandFilesParamValue) => void;
  projectId: string;
  uploadFile: UploadDashboardExtensionCommandFile;
}) => {
  const uploads = [...input.files.uploads];

  for (const [index, upload] of uploads.entries()) {
    if (upload.ref) continue;

    uploads[index] = { ...upload, status: "uploading", error: undefined };
    input.onChange(createCommandFilesParamValue({ refs: input.files.refs, uploads }));

    try {
      const ref = await input.uploadFile(input.projectId, input.commandId, upload.file);
      uploads[index] = { ...upload, ref: ref.id, status: "complete", error: undefined };
      input.onChange(createCommandFilesParamValue({ refs: input.files.refs, uploads }));
    } catch (error) {
      uploads[index] = { ...upload, status: "error", error: uploadErrorMessage(error) };
      input.onChange(createCommandFilesParamValue({ refs: input.files.refs, uploads }));
      throw error;
    }
  }

  return [...input.files.refs, ...uploads.flatMap((upload) => (upload.ref ? [upload.ref] : []))];
};

export const prepareExtensionCommandArgs = async (input: {
  args: unknown;
  commandId: string;
  onArgsChange?: (args: unknown) => void;
  projectId: string;
  uploadFile: UploadDashboardExtensionCommandFile;
}) => {
  if (!isRecord(input.args)) return input.args;

  const displayArgs = { ...input.args };
  const preparedArgs = { ...input.args };

  for (const [key, value] of Object.entries(input.args)) {
    if (!isCommandFilesParamValue(value)) continue;
    preparedArgs[key] = await prepareFilesValue({
      commandId: input.commandId,
      files: value,
      projectId: input.projectId,
      uploadFile: input.uploadFile,
      onChange: (files) => {
        displayArgs[key] = files;
        input.onArgsChange?.(displayArgs);
      },
    });
  }

  return preparedArgs;
};
