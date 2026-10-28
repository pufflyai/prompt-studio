import { defineCommand, type JsonObject, l10n, params } from "@pstdio/sdk/extensions";
import { emptyScribbleDraft } from "./scribble-draft";
import { readScribblePageEntries, saveScribblePage, updateScribblePageFields } from "./scribble-pages-storage";
import { scribbleDraftPage, scribbleDraftResource, scribbleResource } from "./scribble-refs";
import { applyStateChanges, type StateChange } from "./state-changes";
import { examplesChanged } from "./state-events";

export const createScribblePage = defineCommand({
  id: "scribble.pages.create",
  title: l10n("commands.scribbleCreatePage", "New page"),
  cli: { path: ["scribble", "pages", "create"] },
  params: {},
  async run(ctx) {
    const id = crypto.randomUUID();
    ctx.navigation.open({
      kind: "page",
      page: scribbleDraftPage,
      resource: scribbleDraftResource(id, ctx),
      open: "preview",
    });
    return { id };
  },
});

export const saveScribblePageCommand = defineCommand({
  id: "scribble.pages.save",
  title: l10n("commands.scribbleSavePage", "Save page"),
  cli: { path: ["scribble", "pages", "save"] },
  params: {
    id: params.text({ required: true }),
    changes: params.json<StateChange[], { required: true }>({ required: true }),
  },
  async run(ctx, input) {
    const draft = applyStateChanges(emptyScribbleDraft, input.changes);
    const title = draft.title.trim() || emptyScribbleDraft.title;
    await saveScribblePage(ctx.storage, input.id, title, draft.icon, draft.content);
    await ctx.events.emit(examplesChanged, { name: "scribble" });
    return scribbleResource(input.id, title, ctx);
  },
});

export const updateScribblePageCommand = defineCommand({
  id: "scribble.pages.update",
  title: l10n("commands.scribbleUpdatePage", "Edit page"),
  cli: { path: ["scribble", "pages", "update"] },
  params: {
    id: params.text({ required: true }),
    title: params.text({ required: false }),
    icon: params.text({ required: false }),
  },
  async run(ctx, input) {
    const entries = await readScribblePageEntries(ctx.storage);
    if (!entries.some((entry) => entry.document.id === input.id)) throw new Error("Page not found");
    const fields: JsonObject = {};
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new Error("Enter a page name");
      fields.title = title;
    }
    if (input.icon !== undefined) fields.icon = input.icon;
    await updateScribblePageFields(ctx.storage, input.id, fields);
    await ctx.events.emit(examplesChanged, { name: "scribble" });
    return { id: input.id };
  },
});

export const scribbleCommands = {
  "scribble.pages.create": createScribblePage,
  "scribble.pages.save": saveScribblePageCommand,
  "scribble.pages.update": updateScribblePageCommand,
};
