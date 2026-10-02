import { defineArtifactMount, defineResourceKind, type ExtensionContextBase, eventRef } from "@pstdio/sdk/extensions";
import type { Idea, Run, Thread } from "./schemas";

export const radarChanged = eventRef<{ id?: string }>({ extensionId: "pstdio.social-radar", id: "radar.changed" });
export const threadResource = defineResourceKind({ id: "thread", label: "Thread", icon: "message-square" });
export const postMedia = defineArtifactMount({ id: "post-media", path: "post-media", label: "Post media" });
export const runResource = defineResourceKind({ id: "run", label: "Run", icon: "radar" });

export const runsOf = (ctx: ExtensionContextBase) => ctx.storage.collection<Run>("runs");
export const threadsOf = (ctx: ExtensionContextBase) => ctx.storage.collection<Thread>("threads");
export const ideasOf = (ctx: ExtensionContextBase) => ctx.storage.collection<Idea>("ideas");
export const changed = (ctx: ExtensionContextBase, id?: string) => ctx.events.emit(radarChanged, { id });
export const newest = <T>(items: T[], date: (item: T) => string) =>
  items.sort((a, b) => date(b).localeCompare(date(a)));
export const requireThread = async (ctx: ExtensionContextBase, id: string) => {
  const thread = await threadsOf(ctx).get(id);
  if (!thread) throw new Error("Thread not found.");
  return thread;
};
export const runLabel = (run: Run, now = new Date()) => {
  const started = new Date(run.startedAt);
  const time = started.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const day =
    started.toDateString() === now.toDateString()
      ? "Today"
      : started.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${day} · ${time}`;
};
export const runRef = (run: Run) => ({ type: runResource.id, id: run.id, label: runLabel(run) });
export const threadRef = (thread: Thread) => ({ type: threadResource.id, id: thread.id, label: thread.title });
// Pages reference each other by local id; views and pages would otherwise import each other.
export const pageRef = (id: "radar" | "threads" | "thread" | "run") => ({ kind: "page" as const, id });
// Notifications leave the extension, so their targets name the page by its qualified id.
export const qualifiedPageRef = (id: "run") => ({ kind: "page" as const, id: `pstdio.social-radar.page.${id}` });
