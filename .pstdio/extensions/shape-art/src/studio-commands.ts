import { type ControlValue, defineCommand, params } from "@pstdio/sdk/extensions";
import { defaultRecipe } from "./art/recipe";
import { piecesChanged } from "./events";
import { deletePiece, savePiece } from "./pieces/pieces";
import { readStudio, updateStudio, writeStudio } from "./studio-state";

export const studioCommands = {
  "studio.read": defineCommand({
    id: "studio.read",
    title: "Read current art draft",
    cli: true,
    run: readStudio,
  }),
  "studio.set": defineCommand({
    id: "studio.set",
    title: "Change current art draft",
    cli: true,
    mutating: true,
    params: { controlId: params.text({ required: true }), value: params.json({ required: true }) },
    async run(ctx, input) {
      await updateStudio(ctx, input.controlId, input.value as ControlValue);
      return readStudio(ctx);
    },
  }),
  "studio.save": defineCommand({
    id: "studio.save",
    title: "Save current art draft",
    cli: true,
    mutating: true,
    async run(ctx) {
      if (!ctx.projectFiles) throw new Error("Shape Art needs a local project folder");
      const draft = await readStudio(ctx);
      const saved = await savePiece(ctx.projectFiles, draft.id, draft.recipe);
      await ctx.events.emit(piecesChanged, { id: draft.id });
      await writeStudio(ctx, { selected: draft.id });
      return saved;
    },
  }),
  "studio.delete": defineCommand({
    id: "studio.delete",
    title: "Delete current art piece",
    cli: true,
    mutating: true,
    async run(ctx) {
      if (!ctx.projectFiles) throw new Error("Shape Art needs a local project folder");
      const draft = await readStudio(ctx);
      if (draft.selected === "new") return;
      await deletePiece(ctx.projectFiles, draft.selected);
      await ctx.events.emit(piecesChanged, { id: draft.selected });
      await writeStudio(ctx, { selected: "new", id: "untitled", ...defaultRecipe() });
    },
  }),
};
