import type { createAppServerTransport } from "./app-server-transport";
import type { createCodexThread } from "./codex-thread";

export const releaseIdleThread = async (
  rpc: ReturnType<typeof createAppServerTransport>,
  thread: ReturnType<typeof createCodexThread>,
  idle: () => boolean,
  release: () => Promise<boolean>,
) => {
  const ready = () => idle() && thread.isIdle();
  if (!ready()) return false;
  const id = thread.id();
  if (id) {
    const revision = thread.goalRevision();
    const state = (await rpc.request("thread/goal/get", { threadId: id })) as { goal: { status: string } | null };
    if (state.goal?.status === "active" || revision !== thread.goalRevision() || !ready()) return false;
  }
  return release();
};
