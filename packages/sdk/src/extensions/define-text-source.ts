import type { ParamObjectSchema, TextSourceDefinition } from "pstdio-api-contracts/extension-kernel";

/** Separate a text source's domain persistence from its editor presentation. */
export const defineTextSource = <const Schema extends ParamObjectSchema>(
  definition: Omit<TextSourceDefinition<Schema>, "ref">,
) => ({
  ...definition,
  ref: { kind: "text-source" as const, id: definition.id },
});
