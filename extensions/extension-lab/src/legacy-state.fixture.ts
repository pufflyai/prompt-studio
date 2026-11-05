import { defineCommand, defineExtension } from "@pstdio/sdk/extensions";
import { readExampleState, writeExampleState } from "./example-state";
import { readScribbleState, saveScribblePage } from "./scribble-pages-storage";
import { exampleDefaults } from "./state-defaults";

const read = defineCommand({
  id: "read",
  title: "Read retained example edits",
  async run(ctx) {
    return {
      example: await readExampleState(ctx.storage, "boombox"),
      scribble: await readScribbleState(ctx.storage),
    };
  },
});
const write = defineCommand({
  id: "write",
  title: "Save retained example edits",
  mutating: true,
  async run(ctx) {
    await ctx.storage.collection("examples:boombox").put("legacy-filter", {
      path: ["filter"],
      value: "Favorites",
    });
    await ctx.storage.collection("examples:scribble").put("legacy-title", {
      path: ["documents"],
      value: exampleDefaults.scribble.documents.map((document) =>
        document.id === "north-star" ? { ...document, title: "Migrated page" } : document,
      ),
    });
    const migrated = await readScribbleState(ctx.storage);
    await writeExampleState(ctx.storage, "boombox", [{ path: ["query"], value: "Saved search" }]);
    await saveScribblePage(ctx.storage, "north-star", "Saved page", "Document", "Existing page content");
    await saveScribblePage(ctx.storage, "new-page", "New page", "Document", "New page content");
    return { migrated };
  },
});
const update = defineCommand({
  id: "update",
  title: "Continue example edits after restart",
  mutating: true,
  async run(ctx) {
    await writeExampleState(ctx.storage, "boombox", [{ path: ["playing"], value: false }]);
    await saveScribblePage(ctx.storage, "new-page", "Later page", "Document", "Later content");
  },
});
export default defineExtension({ commands: [read, write, update] });
