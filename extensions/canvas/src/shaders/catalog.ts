import type { ArtifactMount } from "@pstdio/sdk/extensions";
import { z } from "zod";

const field = z.object({
  id: z.string(),
  min: z.number().finite(),
  max: z.number().finite(),
  step: z.number().positive(),
  defaultValue: z.number().finite(),
});
const definition = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  description: z.string(),
  groups: z.array(z.object({ fields: z.array(field) })),
});
export type ShaderDefinition = z.infer<typeof definition>;
export type ShaderValues = Record<string, number>;
export const readCatalog = async (files: Pick<ArtifactMount, "exists" | "readText">) => {
  const path = "design/shaders/catalog.json";
  if (!(await files.exists(path))) return [];
  return z.array(definition).parse(JSON.parse(await files.readText(path)));
};
export const defaultValues = (shader: ShaderDefinition) =>
  Object.fromEntries(shader.groups.flatMap((group) => group.fields.map((field) => [field.id, field.defaultValue])));
export const normalizeValues = (shader: ShaderDefinition, input: unknown) => {
  const values = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return Object.fromEntries(
    shader.groups.flatMap((group) =>
      group.fields.map((field) => {
        const raw = values[field.id];
        const value = typeof raw === "number" && Number.isFinite(raw) ? raw : field.defaultValue;
        const stepped = field.min + Math.round((value - field.min) / field.step) * field.step;
        return [field.id, Number(Math.min(field.max, Math.max(field.min, stepped)).toPrecision(12))];
      }),
    ),
  );
};
