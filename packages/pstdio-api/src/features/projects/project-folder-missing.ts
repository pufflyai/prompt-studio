import { projectFolderMissingCode } from "pstdio-api-contracts";

/** Work that needs the project's files ran on a device where the project has no folder yet. */
export class ProjectFolderMissingError extends Error {
  readonly code = projectFolderMissingCode;

  constructor() {
    super("This project's files are not on this device. Choose a folder for the project in Prompt Studio first.");
  }
}
