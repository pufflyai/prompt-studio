import { type CommandContext, commandRef } from "@pstdio/sdk/extensions";

const reportsCommand = commandRef.forExtension({ publisher: "pstdio", name: "pstdio-reports" });
const readReportCommand = reportsCommand<{ id: string }, { id?: string; workspaceId?: string | null; draft?: boolean }>(
  "reports.read",
);

export const readReport = async (ctx: Pick<CommandContext, "commands">, reportId: string) => {
  const outcome = await ctx.commands.execute(readReportCommand, { params: { id: reportId } });
  if (!outcome.ok) throw new Error(`Unknown report "${reportId}": ${outcome.reason}`);
  return outcome.value;
};
