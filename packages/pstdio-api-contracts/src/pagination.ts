import { z } from "zod";

export const pageQuerySchema = z.object({ cursor: z.string().optional(), limit: z.coerce.number().optional() });
export type PageQuery = z.infer<typeof pageQuerySchema>;
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
