import { type CommandContext, type ControlGroup, defineView, l10n, type RendererContext } from "@pstdio/sdk/extensions";
import { commands } from "./commands";
import { listShaders } from "./configs";
import { shadersChanged } from "./events";
import { resolveOpenVersion } from "./navigation";
import { defaultValues, findShader } from "./shaders/definitions";

const compareNone = "none";

const openVersion = async (ctx: Pick<CommandContext, "projectFiles">, renderer: RendererContext) => {
  if (!ctx.projectFiles) throw new Error("Shader Lab needs a local project folder");
  const lab = await listShaders(ctx.projectFiles);
  return { lab, open: resolveOpenVersion(lab, renderer.resource?.id) };
};

// Edits the open version. Each change saves immediately, so the preview follows the sliders.
export const controls = defineView({
  id: "controls",
  title: l10n("controls.title", "Shader"),
  icon: "sliders-horizontal",
  body: {
    kind: "controls",
    refreshEvents: [shadersChanged],
    async query(ctx, { renderer }) {
      const { lab, open } = await openVersion(ctx, renderer);
      if (!open)
        return {
          params: [{ id: "empty", name: "Shader", type: "readOnly", value: "Add a shader from the Shaders list." }],
          values: {},
        };
      const { shader, version } = open;
      const definition = findShader(shader);
      const [config, compare] = await Promise.all([
        ctx.commands.execute(commands["version.read"].ref, { params: { shader, version } }),
        ctx.commands.execute(commands["compare.read"].ref, { params: { shader } }),
      ]);
      if (config.status !== "success") throw new Error(config.reason ?? "Could not read the shader version");
      if (compare.status !== "success") throw new Error(compare.reason ?? "Could not read the compared version");
      const others = lab.find((item) => item.id === shader)?.versions.filter((item) => item.id !== version) ?? [];
      const groups: ControlGroup[] = [
        {
          id: "version",
          title: config.value.name,
          description: `${definition.title}. Add shaders and duplicate, rename, or delete versions from the Shaders list.`,
          params: [
            {
              id: "compare",
              name: "Compare with",
              type: "selection",
              defaultValue: compareNone,
              options: [
                { id: compareNone, name: "Nothing" },
                ...others.map((item) => ({ id: item.id, name: item.name })),
              ],
            },
          ],
        },
        ...definition.groups.map((group) => ({
          id: group.id,
          title: group.title,
          description: group.description,
          params: group.fields.map((field) => ({ ...field, type: "number" as const })),
        })),
      ];
      const compared = others.some((item) => item.id === compare.value.version) ? compare.value.version : null;
      return { groups, values: { ...config.value.values, compare: compared ?? compareNone } };
    },
    async onValueChange(ctx, { renderer, controlId, value }) {
      const { open } = await openVersion(ctx, renderer);
      if (!open) return;
      const { shader, version } = open;
      const outcome =
        controlId === "compare"
          ? await ctx.commands.execute(commands["compare.update"].ref, {
              params: { shader, ...(value === compareNone ? {} : { version: String(value) }) },
            })
          : await ctx.commands.execute(commands["version.update"].ref, {
              params: { shader, version, values: { [controlId]: Number(value) } },
            });
      if (outcome.status !== "success") throw new Error(outcome.reason ?? "Could not save the shader version");
    },
    async onReset(ctx, { renderer, controlIds }) {
      const { open } = await openVersion(ctx, renderer);
      if (!open) return;
      const { shader, version } = open;
      const defaults = defaultValues(findShader(shader));
      const ids = (controlIds ?? Object.keys(defaults)).filter((id) => id in defaults);
      const values = Object.fromEntries(ids.map((id) => [id, defaults[id]]));
      const outcome = await ctx.commands.execute(commands["version.update"].ref, {
        params: { shader, version, values },
      });
      if (outcome.status !== "success") throw new Error(outcome.reason ?? "Could not reset the shader version");
    },
  },
});
