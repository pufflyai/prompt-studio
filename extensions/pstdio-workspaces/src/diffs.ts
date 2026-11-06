import { defineCommand, params } from "@pstdio/sdk/extensions";
import { requireWorkspace } from "./files";

const diffParams = { workspaceId: params.text({ required: true }), mode: params.text({ required: true }) };
const mode = (value: string) => {
  if (value !== "current" && value !== "fork_point") throw new Error("Choose current changes or fork point.");
  return value;
};
export const readChanges = defineCommand({
  id: "read-changes",
  title: "Read workspace changes",
  cli: true,
  params: diffParams,
  async run(ctx, args) {
    const workspace = await requireWorkspace(ctx, undefined, args.workspaceId);
    if (workspace.isDefault || !workspace.capabilities?.diff)
      throw new Error("Changes are unavailable for this workspace.");
    return ctx.workspaces.diffFiles(workspace.id, mode(args.mode));
  },
});
export const readDiff = defineCommand({
  id: "read-diff",
  title: "Read changed file",
  cli: true,
  params: { ...diffParams, path: params.text({ required: true }) },
  async run(ctx, args) {
    const workspace = await requireWorkspace(ctx, undefined, args.workspaceId);
    if (workspace.isDefault || !workspace.capabilities?.diff)
      throw new Error("Changes are unavailable for this workspace.");
    return ctx.workspaces.diffFile(workspace.id, mode(args.mode), args.path);
  },
});
