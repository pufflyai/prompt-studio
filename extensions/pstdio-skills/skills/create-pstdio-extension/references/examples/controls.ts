import { defineCommand, defineView, eventRef, params } from "@pstdio/sdk/extensions";

const changed = eventRef<{ id: string }>({ extensionId: "acme.notes", id: "notes.changed" });
const save = defineCommand({
  id: "save-title",
  title: "Save title",
  params: { id: params.text({ required: true }), title: params.text({ required: true }) },
  async run(ctx, { id, title }) {
    await ctx.storage.collection<string>("titles").put(id, title);
    await ctx.events.emit(changed, { id });
    return { id, title };
  },
});

// This view can serve a routed Main view or any resource-bound inspector.
export const titleEditor = defineView({
  id: "title-editor",
  title: "Note title",
  body: {
    kind: "controls",
    refreshEvents: [changed],
    async query(ctx, { renderer }) {
      const resource = renderer.resource!;
      const title = await ctx.storage.collection<string>("titles").get(resource.id);
      return {
        params: [
          { id: "title", type: "text", name: "Title", defaultValue: "" },
          { id: "id", type: "readOnly", name: "Note", value: resource.id },
        ],
        values: { title: title ?? resource.label ?? "" },
      };
    },
    async onValueChange(ctx, { renderer, value }) {
      const outcome = await ctx.commands.execute(save.ref, {
        params: { id: renderer.resource!.id, title: String(value) },
      });
      if (outcome.status !== "success") throw new Error(outcome.reason ?? "Save failed");
    },
  },
});
export const commands = [save];
