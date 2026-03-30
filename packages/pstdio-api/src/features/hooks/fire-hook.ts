import type { HookName, HookPayload } from "pstdio-wt";
import { runHook } from "pstdio-wt";

type FireHookDeps = {
  repoService: { listByProject: (projectId: string) => Promise<{ path: string }[]> };
};

type FireHookInput = {
  hookName: HookName;
  projectId: string;
  payload: HookPayload;
};

const resolveRepoPath = async (deps: FireHookDeps, projectId: string) => {
  const repos = await deps.repoService.listByProject(projectId);
  return repos[0]?.path ?? null;
};

export const fireHook = async (deps: FireHookDeps, input: FireHookInput) => {
  const repoPath = await resolveRepoPath(deps, input.projectId);
  if (!repoPath) return null;

  return runHook(input.hookName, input.payload, { repoPath });
};
