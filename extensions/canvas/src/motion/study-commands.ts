import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { canvasResource, canvasTarget } from "../navigation";
import { listStudies, readStudy, studiesPath } from "./studies";
import { studiesChanged } from "./study-events";
import { canvasSchema, studyId } from "./study-schema";
export const projectFiles = (ctx: Pick<CommandContext, "projectFiles">) => {
  if (!ctx.projectFiles) throw new Error("Motion Lab needs a local project folder");
  return ctx.projectFiles;
};
const list = defineCommand({
  id: "study.list",
  cli: true,
  title: "List animation studies",
  params: {},
  async run(ctx) {
    return { studies: await listStudies(projectFiles(ctx)) };
  },
});
const read = defineCommand({
  id: "study.read",
  cli: true,
  title: "Read animation study",
  params: { study: params.text({ required: true }) },
  async run(ctx, input) {
    return readStudy(projectFiles(ctx), input.study);
  },
});
const create = defineCommand({
  id: "study.create",
  cli: true,
  mutating: true,
  title: "Create animation study",
  params: {
    id: params.text({ required: true }),
    title: params.text({ required: true }),
    group: params.text({ required: true }),
    description: params.text(),
    duration: params.number(),
    canvas: params.json<JsonValue>(),
  },
  async run(ctx, input) {
    const id = studyId.parse(input.id);
    const files = projectFiles(ctx);
    const path = `${studiesPath}/${id}`;
    if (await files.exists(path)) throw new Error(`Study "${id}" already exists`);
    const { studySchema } = await import("./study-schema");
    const metadata = studySchema.parse({
      title: input.title,
      group: input.group,
      description: input.description ?? "",
      duration: input.duration ?? 6,
      canvas: canvasSchema.parse(input.canvas ?? "workbench"),
    });
    await files.writeText(
      `${path}/scene.tsx`,
      "export default function Scene(props: { time: number }) { return <div>New animation study · {props.time.toFixed(2)} s</div>; }\n",
    );
    await files.writeText(
      `${path}/study.canvas.tsx`,
      `import Scene from "./scene";\nexport default { title: ${JSON.stringify(`Motion/${metadata.group}/${metadata.title}`)}, component: Scene, args: { time: 0 }, motion: { duration: ${metadata.duration} } };\nexport const Default = {};\n`,
    );
    await files.writeText(`${path}/study.json`, `${JSON.stringify(metadata, null, 2)}\n`);
    await ctx.events.emit(studiesChanged, { studies: [id] });
    return { id, target: canvasTarget(`${path}/study.canvas.tsx`, metadata.title, ctx.projectId) };
  },
});
const remove = defineCommand({
  id: "study.delete",
  cli: true,
  mutating: true,
  title: "Delete animation study",
  params: { study: params.text({ required: true }) },
  async run(ctx, input) {
    const id = studyId.parse(input.study);
    await projectFiles(ctx).delete(`${studiesPath}/${id}`);
    await ctx.storage.collection("reviews").delete(id);
    await ctx.storage.collection<boolean>("legacy-imports").put(`motion:${id}`, true);
    await ctx.resources.removed({ type: canvasResource.id, id: `${studiesPath}/${id}/study.canvas.tsx` });
    await ctx.events.emit(studiesChanged, { studies: [id] });
    return { id };
  },
});
const refresh = defineCommand({
  id: "studies.refresh",
  cli: true,
  title: "Refresh animations",
  params: {},
  async run(ctx) {
    await ctx.events.emit(studiesChanged, {});
    return {};
  },
});
export const studyCommands = {
  "study.list": list,
  "study.read": read,
  "study.create": create,
  "study.delete": remove,
  "studies.refresh": refresh,
};

import type { JsonValue } from "@pstdio/sdk/extensions";
