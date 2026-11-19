import type { CommandContext } from "@pstdio/sdk/extensions";
import type { AttemptReadinessResult } from "../data/attempt-readiness";
import type { AttemptRecord } from "../data/attempt-types";
import { renderOwnedTemplate } from "../data/template-store";
import { recoveryPrompt, type WorkspaceRecovery } from "./workspace-recovery";

interface AttemptPromptInput {
  ticket: string;
  workspaceId: string;
  id: string;
  dependencyBase: AttemptRecord["base"];
  recovery?: WorkspaceRecovery;
  adopted: boolean;
  chosenBase?: string;
  headSha: string | null;
  readiness: Extract<AttemptReadinessResult, { decision: "ready" }>;
}

export const attemptPrompt = async (ctx: CommandContext, input: AttemptPromptInput) => {
  const { ticket, workspaceId, id, dependencyBase, recovery, adopted, chosenBase, headSha, readiness } = input;
  return [
    await renderOwnedTemplate(ctx, headSha === null ? "implement-folder-ticket" : "implement-ticket", {
      ticket,
      workspaceId,
      attemptId: id,
    }),
    ...(dependencyBase ? await recoveryPrompt(ctx, recovery, dependencyBase.headSha) : []),
    ...(adopted && dependencyBase
      ? [
          `Continue the existing draft in this workspace on its assigned branch. Its current HEAD is ${headSha}; its required dependency base is ${dependencyBase.headSha}. Preserve all uncommitted work. Commit the draft first, then run update-stack with your implementation session ID and the exact current HEAD before continuing. Validate the integration before submitting. The delivery target for this work is ${typeof chosenBase === "string" ? chosenBase : dependencyBase.headSha}.`,
        ]
      : []),
    ...(!adopted && !recovery && dependencyBase && readiness.mode === "stacked"
      ? [
          `This workspace starts at base ${dependencyBase.headSha}. Required dependency workspaces: ${readiness.dependencyAttemptIds.join(", ")}. Keep the assigned branch. Verify the submitted dependency commits are present and use update-stack if needed. If their automatic combination conflicts, reconcile the code in this workspace, commit, and retry update-stack. Do not request review for Git conflicts; ask only if features, concepts, plans, requirements, or architecture conflict. Do not reset to the target branch, recreate dependency code, approve work, or mark a ticket Done to repair its base.`,
        ]
      : []),
  ].join("\n\n");
};
