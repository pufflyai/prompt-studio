import { defineCommand, params } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { appendAttemptEvent, putAttempt, readAttempt } from "../data/attempt-storage";
import { ticketsCollection } from "../data/collections";
import { withWriteGuard } from "../data/write-guard";
import { workspaceGitPath, workspaceHead } from "./change-requests";
import { readDependencyHeads } from "./stack-validation";

export const updateStackCommand = defineCommand({
  id: "update-stack",
  title: "Record a validated dependency integration",
  cli: true,
  mutating: true,
  params: {
    workspaceId: params.text({ required: true }),
    implementationSessionId: params.text({ required: true }),
    expectedHeadSha: params.text({ required: true }),
    baseHeadSha: params.text({ required: true }),
  },
  async run(ctx, input) {
    return withWriteGuard(ctx, `attempt:${input.workspaceId}`, async () => {
      const attempt = await readAttempt(ctx.storage, input.workspaceId);
      if (!attempt || attempt.implementationSessionId !== input.implementationSessionId)
        throw new Error("The implementation session does not own this variant.");
      if ((await workspaceHead(ctx, attempt.workspaceId)) !== input.expectedHeadSha)
        throw new Error("Workspace HEAD changed before stack update.");
      const path = await workspaceGitPath(ctx, attempt.workspaceId);
      const contains = async (base: string, head: string) => {
        const result = await ctx.process.run({
          command: ["git", "-C", path, "merge-base", "--is-ancestor", base, head],
        });
        if (result.exitCode !== 0) throw new Error(`Integration ${head} must contain dependency commit ${base}.`);
      };
      await contains(input.baseHeadSha, input.expectedHeadSha);
      const ticket = await ticketsCollection(ctx.storage).get(attempt.ticketId);
      if (!ticket) throw new Error("The variant ticket is missing.");
      const dependencies = await readDependencyHeads(ctx, attempt.ticketId);
      const dependencyHeads = dependencies.map(({ headSha }) => headSha);
      for (const head of dependencyHeads) await contains(head, input.baseHeadSha);
      const next = await putAttempt(ctx.storage, {
        ...attempt,
        base: { workspaceId: null, headSha: input.baseHeadSha },
        updatedAt: new Date().toISOString(),
      });
      await appendAttemptEvent(ctx.storage, {
        workspaceId: attempt.workspaceId,
        revision: attempt.revisions.at(-1)?.revision ?? null,
        type: "stack_updated",
        actor: actorFromSource(ctx.source, ctx.invocationId),
        sessionId: attempt.implementationSessionId,
        reportId: null,
        reviewId: null,
        threadId: null,
        commitSha: input.expectedHeadSha,
        metadata: { previousBase: attempt.base.headSha, baseHeadSha: input.baseHeadSha, dependencyHeads },
      });
      return next;
    });
  },
});
