import { defineView } from "@pstdio/sdk/extensions";
import { piecesChanged, studioChanged } from "./events";
import { listPieces } from "./pieces/pieces";
import { readStudio, updateStudio } from "./studio-state";
import { recipeGroups } from "./view/recipe-controls";

export const settingsView = defineView({
  id: "settings",
  title: "Art settings",
  icon: "settings",
  body: {
    kind: "controls",
    refreshEvents: [studioChanged, piecesChanged],
    async query(ctx) {
      const draft = await readStudio(ctx);
      const pieces = ctx.projectFiles ? await listPieces(ctx.projectFiles) : [];
      return {
        groups: [
          {
            id: "piece",
            title: "Piece",
            params: [
              {
                id: "piece",
                name: "Open",
                type: "selection" as const,
                defaultValue: draft.selected,
                options: [{ id: "new", name: "New piece" }, ...pieces.map(({ id }) => ({ id, name: id }))],
              },
              { id: "id", name: "File name", type: "text" as const, singleLine: true, defaultValue: draft.id },
            ],
          },
          ...recipeGroups(draft.recipe),
        ],
        values: { piece: draft.selected, id: draft.id, ...draft.recipe },
      };
    },
    onValueChange: (ctx, input) => updateStudio(ctx, input.controlId, input.value),
  },
});
