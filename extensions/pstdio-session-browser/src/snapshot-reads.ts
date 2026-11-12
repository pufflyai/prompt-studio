import type { ChatRendererSnapshot, ExtensionContextBase, ExtensionWorkspace } from "@pstdio/sdk/extensions";
import type { nativePresentation } from "./native-presentation";
import { readQueue } from "./queue-snapshot";

export interface SnapshotReads {
  execution: Awaited<ReturnType<ExtensionContextBase["sessions"]["getExecutionState"]>>;
  queued: Awaited<ReturnType<typeof readQueue>>;
  session: Awaited<ReturnType<ExtensionContextBase["sessions"]["getConversation"]>>["session"];
  harness: Awaited<ReturnType<ExtensionContextBase["sessions"]["getHarnessCommands"]>> | undefined;
  workspace: ExtensionWorkspace | undefined;
  presentation?: ChatRendererSnapshot["workspace"];
  native?: Awaited<ReturnType<typeof nativePresentation>>;
}
export interface SnapshotOptions {
  messages?: boolean;
  queue?: ReturnType<typeof readQueue>;
  previous?: SnapshotReads;
  changes?: ReadonlySet<string>;
}
export const readSnapshotInputs = async (ctx: ExtensionContextBase, id: string, options: SnapshotOptions) => {
  const previous = options.previous;
  const sessionRead = !previous || Boolean(options.changes?.has("session"));
  const executionRead = sessionRead || options.changes?.has("execution");
  const queueRead = executionRead || options.changes?.has("queue");
  // Own both parallel reads immediately, including their cancellation failures.
  const [execution, queued] = await Promise.all([
    executionRead ? ctx.sessions.getExecutionState(id) : previous!.execution,
    queueRead ? (options.queue ?? readQueue(ctx, id)) : previous!.queued,
  ]);
  const remote = execution.kind === "remote";
  const readConversation = async () => {
    if (!remote && options.messages !== false) return ctx.sessions.getConversation(id);
    const session = sessionRead ? await ctx.sessions.get(id) : previous!.session;
    if (!session) throw new Error("Session not found.");
    const sources = remote && options.messages !== false ? await ctx.sessions.getConversationSources(id) : undefined;
    return { session, messages: sources?.checkpoint ?? [] };
  };
  const readHarness = () => {
    if (remote) return undefined;
    return sessionRead || options.changes?.has("harness") ? ctx.sessions.getHarnessCommands(id) : previous!.harness;
  };
  const [{ session, messages }, harness] = await Promise.all([readConversation(), readHarness()]);
  const workspaceId = session.workspaceId ?? undefined;
  let workspace = previous?.workspace;
  if (sessionRead || options.changes?.has("workspace"))
    workspace = workspaceId ? ((await ctx.workspaces.get(workspaceId)) ?? undefined) : undefined;
  return { sessionRead, executionRead, queueRead, messages, reads: { execution, queued, session, harness, workspace } };
};
