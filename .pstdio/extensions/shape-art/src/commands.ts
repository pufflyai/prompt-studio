import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { generateRecipe } from "./art/generate";
import { piecesChanged } from "./events";
import { deletePiece, listPieces, readPiece, renderPiece, savePiece } from "./pieces/pieces";

const projectFiles = (ctx: Pick<CommandContext, "projectFiles">) => {
  if (!ctx.projectFiles) throw new Error("Shape Art needs a local project folder");
  return ctx.projectFiles;
};

const pieceParam = { id: params.text({ required: true, label: "Piece id (kebab-case)" }) };

export const commands = {
  "piece.generate": defineCommand({
    id: "piece.generate",
    cli: true,
    mutating: true,
    title: "Generate random art piece",
    description: "Randomize composition and paint settings, then save the recipe and PNG under design/art.",
    params: {
      ...pieceParam,
      background: params.select({
        label: "Background preset",
        options: [
          { label: "Paper", value: "paper" },
          { label: "Ink", value: "ink" },
        ],
        defaultValue: "paper",
      }),
      width: params.number({ label: "Width in pixels (64–4096)", defaultValue: 1600 }),
      height: params.number({ label: "Height in pixels (64–4096)", defaultValue: 900 }),
      seed: params.text({ label: "Seed (omit for a new random piece)" }),
    },
    async run(ctx, input) {
      const saved = await savePiece(projectFiles(ctx), input.id, generateRecipe(input));
      await ctx.events.emit(piecesChanged, { id: input.id });
      return saved;
    },
  }),
  "piece.list": defineCommand({
    id: "piece.list",
    cli: true,
    title: "List art pieces",
    params: {},
    async run(ctx) {
      return { pieces: await listPieces(projectFiles(ctx)) };
    },
  }),
  "piece.read": defineCommand({
    id: "piece.read",
    cli: true,
    title: "Read art piece recipe",
    params: pieceParam,
    async run(ctx, input) {
      return { id: input.id, recipe: await readPiece(projectFiles(ctx), input.id) };
    },
  }),
  "piece.save": defineCommand({
    id: "piece.save",
    cli: true,
    mutating: true,
    title: "Save art piece",
    description: "Write the recipe to design/art/<id>.json and paint design/art/<id>.png. Missing fields use defaults.",
    params: { ...pieceParam, recipe: params.json({ label: "Recipe" }) },
    async run(ctx, input) {
      const saved = await savePiece(projectFiles(ctx), input.id, input.recipe ?? {});
      await ctx.events.emit(piecesChanged, { id: input.id });
      return saved;
    },
  }),
  "piece.render": defineCommand({
    id: "piece.render",
    cli: true,
    mutating: true,
    title: "Repaint art piece",
    description: "Repaint design/art/<id>.png after editing its recipe file.",
    params: pieceParam,
    async run(ctx, input) {
      const saved = await renderPiece(projectFiles(ctx), input.id);
      await ctx.events.emit(piecesChanged, { id: input.id });
      return saved;
    },
  }),
  "piece.delete": defineCommand({
    id: "piece.delete",
    cli: true,
    mutating: true,
    title: "Delete art piece",
    params: pieceParam,
    async run(ctx, input) {
      await deletePiece(projectFiles(ctx), input.id);
      await ctx.events.emit(piecesChanged, { id: input.id });
      return { id: input.id };
    },
  }),
};
