import type { HookName } from "pstdio-wt";
import { runHook } from "pstdio-wt";
import type { RouteDeps } from "../deps";

type FireHookInput = {
  hookName: HookName;
  projectId: string;
  payload: Record<string, unknown>;
};

const resolveRepoPath = async (deps: Pick<RouteDeps, "reposService">, projectId: string) => {
  const repos = await deps.reposService.listByProject(projectId);
  return repos[0]?.path ?? null;
};

export const fireHook = async (deps: Pick<RouteDeps, "reposService">, input: FireHookInput) => {
  const repoPath = await resolveRepoPath(deps, input.projectId);
  if (!repoPath) return null;

  return runHook(input.hookName, { repoPath, payload: input.payload }, repoPath);
};
