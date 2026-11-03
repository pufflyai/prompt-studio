import { z } from "zod";

export const sessionLogPublicationSchema = z.object({
  version: z.string(),
  head: z.number().int().nonnegative(),
});

export type SessionLogPublication = z.infer<typeof sessionLogPublicationSchema>;

/** A terminal row is complete only after this version's messages have been published. */
export const sessionLogVersion = (session: { status: string; updated_at?: string | null }) =>
  JSON.stringify([session.status, session.updated_at ?? null]);
