import { z } from "zod";

export const fileRecordSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  file_name: z.string(),
  file_kind: z.string(),
  storage_path: z.string(),
  mime_type: z.string().nullable(),
  size_bytes: z.number(),
  hash: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type FileRecord = z.infer<typeof fileRecordSchema>;
