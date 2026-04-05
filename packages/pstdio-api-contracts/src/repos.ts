import { z } from "zod";

export const repoSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  display_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const registerRepoInputSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
});

export type Repo = z.infer<typeof repoSchema>;
export type RegisterRepoInput = z.infer<typeof registerRepoInputSchema>;
