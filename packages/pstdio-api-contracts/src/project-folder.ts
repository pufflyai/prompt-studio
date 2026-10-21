import { z } from "zod";

/** Where a project's files are on this device. A cloud project from another device starts without a folder. */
export const projectFolderSchema = z.object({
  path: z.string().nullable(),
  /** The `origin` remote recorded for the project, which a device without a folder can clone. */
  gitRemote: z.string().nullable(),
});
export const chooseProjectFolderInputSchema = z.object({
  path: z.string().min(1).describe("Absolute folder path. A clone creates it."),
  clone: z.boolean().describe("Clone the project's recorded git remote into the folder."),
});
export type ProjectFolder = z.infer<typeof projectFolderSchema>;
export type ChooseProjectFolderInput = z.infer<typeof chooseProjectFolderInputSchema>;
