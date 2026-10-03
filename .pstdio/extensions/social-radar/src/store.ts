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
const runTime = (run: Run) =>
  new Date(run.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const runDate = (run: Run) => new Date(run.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
/** The Sidenav row says "Today"; stored and shared labels keep the date, so they do not go stale. */
export const runLabel = (run: Run, now = new Date()) => {
  const today = new Date(run.startedAt).toDateString() === now.toDateString();
  return `${today ? "Today" : runDate(run)} · ${runTime(run)}`;
};
export const runRef = (run: Run) => ({ type: runResource.id, id: run.id, label: `${runDate(run)} · ${runTime(run)}` });
export const threadRef = (thread: Thread) => ({ type: threadResource.id, id: thread.id, label: thread.title });
// Pages reference each other by local id; views and pages would otherwise import each other.
export const pageRef = (id: "radar" | "threads" | "thread" | "run" | "settings") => ({ kind: "page" as const, id });
// Notifications leave the extension, so their targets name the page by its qualified id.
export const qualifiedPageRef = (id: "run") => ({ kind: "page" as const, id: `pstdio.social-radar.page.${id}` });
