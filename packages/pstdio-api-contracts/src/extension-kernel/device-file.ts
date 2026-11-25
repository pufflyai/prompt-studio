import { z } from "zod";

/** Device destinations are chosen by the host, never supplied by a guest. */
export const deviceFileInputSchema = z.strictObject({
  name: z
    .string()
    .min(1)
    .regex(/^[^/\\\\]+$/)
    .refine((name) => name !== "." && name !== ".." && [...name].every((char) => char.charCodeAt(0) >= 32)),
  data: z.union([z.instanceof(Uint8Array), z.instanceof(ArrayBuffer)]),
  mimeType: z.string().optional(),
});
