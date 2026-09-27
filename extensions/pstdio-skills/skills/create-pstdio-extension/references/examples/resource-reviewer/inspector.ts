import { type ControlGroup, defineView, l10n } from "@pstdio/sdk/extensions";
import { getItem, settingsChanged } from "./catalog";
import { commands } from "./commands";

export const inspector = defineView({
  id: "inspector",
  title: l10n("inspector.title", "Properties"),
  body: {
    kind: "controls",
    refreshEvents: [settingsChanged],
    async query(ctx, { renderer }) {
      const id = renderer.resource!.id;
      const result = await ctx.commands.execute(commands["review.read"].ref, { params: { id } });
      if (result.status !== "success") throw new Error(result.reason ?? "Could not load review settings");
      const groups: ControlGroup[] = [
        {
          id: "appearance",
          title: "Preview",
          description: "Apply changes to save settings for this item and refresh its preview.",
          params: [
            { id: "heading", name: "Heading", type: "text", defaultValue: "", singleLine: true },
            { id: "showDetails", name: "Show details", type: "boolean", defaultValue: true },
          ],
        },
        {
          id: "information",
          title: "Information",
          params: [{ id: "about", name: "About", type: "readOnly", value: getItem(id).description }],
        },
      ];
      return { groups, values: { ...result.value } };
    },
    async onApply(ctx, { renderer, values }) {
      const result = await ctx.commands.execute(commands["review.update"].ref, {
        params: {
          id: renderer.resource!.id,
          heading: String(values.heading),
          showDetails: values.showDetails === true,
        },
      });
      if (result.status !== "success") throw new Error(result.reason ?? "Could not save review settings");
    },
  },
});
