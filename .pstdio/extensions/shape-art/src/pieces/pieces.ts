import type { ArtifactMount } from "@pstdio/sdk/extensions";
import { z } from "zod";
import { recipeSchema } from "../art/recipe";
import { renderPiece as paint } from "../art/render";
import { encodePng } from "./png";

/** Recipes and their rendered images live in the repo, so the art is versioned with the code that uses it. */
const piecesPath = "design/art";

const pieceId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use a kebab-case piece id");
const recipePath = (id: string) => `${piecesPath}/${pieceId.parse(id)}.json`;
const imagePath = (id: string) => `${piecesPath}/${pieceId.parse(id)}.png`;

/** The file name is the piece's only name. */
export const listPieces = async (files: ArtifactMount) =>
  (await files.list(`${piecesPath}/*.json`))
    .filter(({ path }) => /^design\/art\/[a-z0-9-]+\.json$/.test(path))
    .map(({ path }) => path.slice(piecesPath.length + 1, -".json".length))
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, image: imagePath(id) }));

export const readPiece = async (files: ArtifactMount, id: string) =>
  recipeSchema.parse(JSON.parse(await files.readText(recipePath(id))));

/** Writes the recipe, filling missing fields with defaults, and paints its image at full size. */
export const savePiece = async (files: ArtifactMount, id: string, recipe: unknown) => {
  const parsed = recipeSchema.parse(recipe);
  await files.writeText(recipePath(id), `${JSON.stringify(parsed, null, 2)}\n`);
  const { width, height, pixels } = paint(parsed);
  await files.writeBytes(imagePath(id), encodePng(width, height, pixels));
  return { id, recipe: parsed, recipePath: recipePath(id), imagePath: imagePath(id) };
};

/** Repaints the image after the recipe file was edited by hand. */
export const renderPiece = async (files: ArtifactMount, id: string) => savePiece(files, id, await readPiece(files, id));

export const deletePiece = async (files: ArtifactMount, id: string) => {
  await files.delete(recipePath(id));
  if (await files.exists(imagePath(id))) await files.delete(imagePath(id));
};
