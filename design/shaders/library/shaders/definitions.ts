import catalog from "../../catalog.json";
// Shader definitions are plain data, shared by commands, controls, and the preview.
export interface ShaderField {
  id: string;
  name: string;
  description: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface ShaderGroup {
  id: string;
  title: string;
  description: string;
  fields: ShaderField[];
}

export interface ShaderDefinition {
  id: string;
  title: string;
  description: string;
  groups: ShaderGroup[];
}

export type ShaderValues = Record<string, number>;

export const shaders: ShaderDefinition[] = catalog;

export const findShader = (id: string) => {
  const shader = shaders.find((definition) => definition.id === id);
  if (!shader) throw new Error(`Unknown shader "${id}"`);
  return shader;
};

const shaderFields = (shader: ShaderDefinition) => shader.groups.flatMap((group) => group.fields);

export const defaultValues = (shader: ShaderDefinition) =>
  Object.fromEntries(shaderFields(shader).map((item) => [item.id, item.defaultValue])) as ShaderValues;

// Accepts any saved or submitted value; each field falls back to its default and stays in range.
export const normalizeValues = (shader: ShaderDefinition, value: unknown) => {
  const input = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    shaderFields(shader).map((item) => {
      const raw = input[item.id];
      const number = typeof raw === "number" && Number.isFinite(raw) ? raw : item.defaultValue;
      const stepped = item.min + Math.round((number - item.min) / item.step) * item.step;
      // Decimal steps should not save floating-point padding into version files.
      return [item.id, Number(Math.min(item.max, Math.max(item.min, stepped)).toPrecision(12))];
    }),
  ) as ShaderValues;
};
