import type { ControlValue, ExtensionContextBase, JsonObject } from "@pstdio/sdk/extensions";
import { defaultRecipe, recipeSchema } from "./art/recipe";
import { studioChanged } from "./events";
import { readPiece } from "./pieces/pieces";
import { applyChange } from "./view/recipe-controls";

export const readStudio = async (ctx: ExtensionContextBase) => {
  const record = await ctx.storage.records.read(ctx.storage.records.id("studio"));
  const value = (record.value ?? {}) as JsonObject;
  return {
    selected: typeof value.selected === "string" ? value.selected : "new",
    id: typeof value.id === "string" ? value.id : "untitled",
    recipe: recipeSchema.parse(value),
  };
};
export type StudioDraft = Awaited<ReturnType<typeof readStudio>>;

export const writeStudio = async (ctx: ExtensionContextBase, patch: JsonObject) => {
  await ctx.storage.records.commit({
    operationId: ctx.storage.ids.create(),
    edits: [
      {
        recordId: ctx.storage.records.id("studio"),
        set: Object.fromEntries(Object.entries(patch).map(([key, value]) => [`/${key}`, value])),
      },
    ],
  });
  await ctx.events.emit(studioChanged, {});
};

export const updateStudio = async (ctx: ExtensionContextBase, controlId: string, value: ControlValue) => {
  if (controlId === "piece") {
    const selected = String(value);
    if (selected === "new") return writeStudio(ctx, { selected, id: "untitled", ...defaultRecipe() });
    if (!ctx.projectFiles) throw new Error("Shape Art needs a local project folder");
    return writeStudio(ctx, { selected, id: selected, ...(await readPiece(ctx.projectFiles, selected)) });
  }
  if (controlId === "id") return writeStudio(ctx, { id: String(value) });
  const { recipe } = await readStudio(ctx);
  const next = recipeSchema.parse(applyChange(recipe, controlId, value));
  const patch = Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(recipe[key as keyof typeof recipe]),
    ),
  );
  if (Object.keys(patch).length) await writeStudio(ctx, patch);
};
