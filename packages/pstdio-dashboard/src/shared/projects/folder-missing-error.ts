import { PstdioApiError } from "@pstdio/sdk/client";
import { projectFolderMissingCode } from "pstdio-api-contracts";

/** The work needs the project's files, and the project has no folder on this device yet. */
export const isFolderMissingError = (error: unknown) =>
  error instanceof PstdioApiError && error.code === projectFolderMissingCode;
