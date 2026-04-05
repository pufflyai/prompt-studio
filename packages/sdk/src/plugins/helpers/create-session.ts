import type { CreateSessionInput } from "../../api/sessions";
import type { PluginHelperContext } from "./context";

type CreateSessionHelperInput = Omit<CreateSessionInput, "project_id">;

export const createSession = async (ctx: PluginHelperContext, input: CreateSessionHelperInput) =>
  ctx.client.sessions.create({
    project_id: ctx.projectId,
    ...input,
  });
