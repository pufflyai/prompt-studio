import { defineView, type TreeNode, workbenchPanels } from "@pstdio/sdk/extensions";
import { commands } from "../commands";
import { isNewPost, type Run, type Thread } from "../schemas";
import { siteLabels } from "../sites";
import { newest, pageRef, radarChanged, runLabel, runRef, runsOf, threadsOf } from "../store";
import { plural } from "../text";

const runIcon = (run: Run) => {
  if (run.status === "running") return { icon: "LoaderCircle", iconColor: "fg.info" };
  if (run.status === "failed") return { icon: "CircleX", iconColor: "fg.error" };
  if (run.skippedSites?.length) return { icon: "CircleAlert", iconColor: "fg.warning" };
  return { icon: "CircleCheck", iconColor: "fg.success" };
};
// Tree rows show no trailing text, so the tooltip on the status icon carries the run's result.
const runTooltip = (run: Run, threads: Thread[]) => {
  if (run.status === "running") return "Running";
  if (run.status === "failed") return `Failed: ${run.failureReason ?? "unknown reason"}`;
  const found = threads.filter((thread) => thread.runId === run.id && !isNewPost(thread)).length;
  const skipped = run.skippedSites?.map((skip) => siteLabels[skip.site]) ?? [];
  return [plural(found, "thread"), skipped.length ? `Skipped ${skipped.join(", ")}` : ""].filter(Boolean).join(" · ");
};
const runNode = (run: Run, threads: Thread[]): TreeNode => {
  const resource = runRef(run);
  const digest: TreeNode = {
    id: `${run.id}:digest`,
    label: "Digest",
    icon: "FileText",
    target: { kind: "page", page: pageRef("run"), resource },
  };
  const session: TreeNode = {
    id: `${run.id}:session`,
    label: "Session",
    icon: "MessageCircle",
    target: {
      kind: "panel",
      panel: workbenchPanels.projectSession,
      resource: { type: "session", id: run.sessionId, label: `Social radar ${resource.label}` },
      open: "preview",
    },
  };
  return {
    id: run.id,
    label: runLabel(run),
    ...runIcon(run),
    iconTooltip: runTooltip(run, threads),
    resource,
    target: { kind: "page", page: pageRef("run"), resource },
    children: run.sessionId ? [session, digest] : [digest],
  };
};

export const radarTree = defineView({
  id: "radar-navigation",
  title: "Social radar",
  body: {
    kind: "tree",
    refreshEvents: [radarChanged],
    defaultExpandedSectionIds: ["runs"],
    async body(ctx) {
      const runs = newest(await runsOf(ctx).list(), (run) => run.startedAt).slice(0, 14);
      const threads = await threadsOf(ctx).list();
      return [
        {
          id: "pages",
          collapsible: false,
          nodes: [
            { id: "threads", label: "Threads", icon: "List", target: { kind: "page", page: pageRef("threads") } },
          ],
        },
        {
          id: "runs",
          label: "Runs",
          actions: [{ id: "run-daily", label: "Run now", icon: "Play", command: commands["run-daily"].ref }],
          emptyState: { title: "No runs yet", description: "Run now, or wait for the 07:00 run." },
          nodes: runs.map((run) => runNode(run, threads)),
        },
      ];
    },
  },
});
