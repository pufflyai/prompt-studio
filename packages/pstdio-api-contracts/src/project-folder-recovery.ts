import { z } from "zod";

/**
 * Folder recovery restores a project folder that another of your devices captured to Cloud.
 * Each device keeps its own copy; this device downloads every completed copy into its local
 * recovery store, so restoring works while the source device is offline.
 */
export const projectFolderSourceRefSchema = z
  .object({
    /** The device that captured the folder. */
    deviceId: z.string().min(1).max(256),
    /** That device's folder copy, from `folderSources`. */
    sourceId: z.string().min(1).max(256),
  })
  .strict();

export const projectFolderSourceSchema = projectFolderSourceRefSchema.extend({
  /** This device's own copy. */
  current: z.boolean(),
  /** Device name and original folder. Null until the copy's description has downloaded. */
  name: z.string().nullable(),
  folder: z.string().nullable(),
  /** When the last completed capture started and finished. The folder can change while it is read. */
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  /** Included files and their bytes. Paths excluded by the root `.pstignore` are not counted. */
  files: z.number().int().nonnegative().nullable(),
  bytes: z.number().int().nonnegative().nullable(),
  /** The applied root `.pstignore`. Null means the folder had none, so every file was included. */
  policy: z.string().nullable(),
  /** `functional` restores a working repository; `incomplete` keeps the files but not working Git. */
  git: z.enum(["none", "functional", "incomplete"]).nullable(),
  /** Every byte of this copy is in this device's recovery store, so restoring needs no connection. */
  available: z.boolean(),
});

export const restoreProjectFolderInputSchema = projectFolderSourceRefSchema.extend({
  path: z
    .string()
    .min(1)
    .describe("Absolute path, or one under `~/`, of a folder that does not exist yet. Its parent must exist."),
});

export const folderRecoveryErrorCodeSchema = z.enum([
  /** The destination exists, even if empty. Choose a new folder. */
  "destination_exists",
  /** The destination's parent folder does not exist. */
  "destination_parent_missing",
  /** The folder name, or a restored path inside it, is longer than this platform allows. */
  "destination_too_long",
  /** Something created the destination during the restore. Nothing was replaced. */
  "destination_created",
  /** The copy contains a path or entry this device refuses to write. */
  "unsafe_entry",
  /** Two entries name the same file on this filesystem, for example on a case-insensitive disk. */
  "name_collision",
  /** Downloaded bytes failed verification. Download the copy again. */
  "integrity",
  /** This platform or filesystem cannot restore safely. */
  "unsupported",
  /** The copy is not fully on this device and Cloud is not reachable. */
  "not_downloaded",
  /** This device has not unlocked its private Cloud keys since starting. Connect to Cloud once. */
  "keys_unavailable",
  /** No copy with this device and source exists. */
  "source_not_found",
  /** Another download or restore is running for this project. */
  "busy",
  "cancelled",
  /** An included folder entry could not be captured. Its path names the entry. */
  "capture_incomplete",
  "failed",
]);

export const folderRecoveryErrorSchema = z.object({
  code: folderRecoveryErrorCodeSchema,
  message: z.string(),
  /** A folder-relative path when one entry caused the error. */
  path: z.string().nullable(),
});

const progressSchema = z.object({
  state: z.enum(["idle", "running", "complete", "failed", "cancelled"]),
  source: projectFolderSourceRefSchema.nullable(),
  /** Bytes transferred or written so far, and the total when known. */
  bytes: z.object({ completed: z.number().int().nonnegative(), total: z.number().int().nonnegative().nullable() }),
  error: folderRecoveryErrorSchema.nullable(),
});

/** Derived on each read from this process's recovery owner. Never stored. */
export const projectFolderRecoveryStatusSchema = z.object({
  /** This device's capture of its own folder, which uploads to Cloud when it completes. */
  capture: z.object({
    state: z.enum(["idle", "pending", "running", "needs-attention"]),
    folder: z.string().nullable(),
    error: folderRecoveryErrorSchema.nullable(),
  }),
  /** Downloading one device's copy into this device's recovery store. */
  download: progressSchema,
  /** Writing a copy into a new folder. It is attached only after every entry is verified. */
  restore: progressSchema.extend({
    destination: z.string().nullable(),
    files: z.object({ completed: z.number().int().nonnegative(), total: z.number().int().nonnegative().nullable() }),
    /** Set when the restore completed. */
    result: z
      .object({
        path: z.string(),
        /** Whether the folder became the project's folder. A project that already has one keeps it. */
        attached: z.boolean(),
        git: z.enum(["none", "functional", "incomplete"]),
        /** Restored paths whose bytes differ from the copy because Git links were rebuilt for this folder. */
        rewritten: z.array(z.string()),
        /**
         * Git links that pointed outside the restored folder and were left out, so the folder never
         * shares another repository. Their original bytes stay in the recovery store.
         */
        omitted: z.array(
          z.object({ path: z.string(), reason: z.enum(["git-link-outside-folder", "git-setting-outside-folder"]) }),
        ),
      })
      .nullable(),
  }),
});

export type ProjectFolderSourceRef = z.infer<typeof projectFolderSourceRefSchema>;
export type ProjectFolderSource = z.infer<typeof projectFolderSourceSchema>;
export type RestoreProjectFolderInput = z.infer<typeof restoreProjectFolderInputSchema>;
export type FolderRecoveryErrorCode = z.infer<typeof folderRecoveryErrorCodeSchema>;
export type FolderRecoveryError = z.infer<typeof folderRecoveryErrorSchema>;
export type ProjectFolderRecoveryStatus = z.infer<typeof projectFolderRecoveryStatusSchema>;
