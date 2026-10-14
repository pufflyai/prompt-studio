import {
  resourceContextMenuPath,
  type WorkbenchCommandExecutionContext,
  type WorkbenchModuleContext,
  workbenchResourceMetadataContextKey,
  workbenchResourceTypeContextKey,
} from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { getCollection, getWriter } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { findDashboardSession } from "./data/dashboard-sessions";

interface SessionActionArgs {
  sessionId?: string;
  title?: string;
}
const resolveSession = (
  ctx: WorkbenchModuleContext,
  args: SessionActionArgs | undefined,
  context?: WorkbenchCommandExecutionContext,
) => {
  const target = context?.resource ?? ctx.getActiveResource();
  const id = args?.sessionId ?? (target?.type === "session" ? target.id : undefined);
  const session = findDashboardSession(id);
  if (!session) throw new Error("Choose a saved session first.");
  return session;
};
const sessionWhen = `${workbenchResourceTypeContextKey} == "session"`;
const statusKey = workbenchResourceMetadataContextKey("status");
const busyStatuses = ["in_progress", "awaiting_input", "queued"];
const busyWhen = busyStatuses.map((status) => `${sessionWhen} && ${statusKey} == "${status}"`).join(" || ");
const idleWhen = `${sessionWhen} && ${busyStatuses.map((status) => `${statusKey} != "${status}"`).join(" && ")}`;

export const registerSessionResourceActions = (ctx: WorkbenchModuleContext) => {
  ctx.commands.registerCommand(
    {
      id: dashboardCommandIds.renameSession,
      label: "Rename session",
      category: "Session",
      icon: "Pencil",
      when: sessionWhen,
    },
    {
      prepareArgs: (args: SessionActionArgs | undefined, context) => {
        const session = resolveSession(ctx, args, context);
        return { ...args, sessionId: session.id, title: args?.title ?? session.title };
      },
      execute: async (args: SessionActionArgs | undefined, context) => {
        const session = resolveSession(ctx, args, context);
        if (args?.title === undefined) {
          ctx.commandPalette.requestParams({
            record: {
              command: {
                id: dashboardCommandIds.renameSession,
                label: "Rename session",
                params: { title: { type: "text", label: "Session name", required: true } },
              },
            },
            label: "Rename session",
            args: { sessionId: session.id, title: session.title },
            context: { resource: session.resource },
          });
          return;
        }
        const title = args.title.trim();
        if (!title) throw new Error("Enter a session name.");
        const preview = ctx.resources.preview.begin(session.resource, { label: title });
        try {
          const updated = await ctx.resources.preview.persist(session.resource, () =>
            getApiClient().sessions.rename(session.id, title),
          );
          // Use the persisted response so the preview need not wait for the sync connection.
          getWriter("sessions")?.upsert(updated);
          await preview.commit();
          return updated;
        } catch (error) {
          preview.rollback();
          throw error;
        }
      },
    },
  );
  for (const kind of ["archive", "delete"] as const) {
    const label = kind === "archive" ? "Archive session" : "Delete session";
    const commandId = kind === "archive" ? dashboardCommandIds.archiveSession : dashboardCommandIds.deleteSession;
    ctx.commands.registerCommand(
      { id: commandId, label, category: "Session", icon: kind === "archive" ? "Archive" : "Trash2", when: sessionWhen },
      {
        prepareArgs: (args: SessionActionArgs | undefined, context) => ({
          sessionId: resolveSession(ctx, args, context).id,
        }),
        execute: async (args: SessionActionArgs | undefined, context) => {
          const session = resolveSession(ctx, args, context);
          const archiveWork =
            session.status === "queued"
              ? "Queued work will be cancelled."
              : "Running work or work awaiting input will continue.";
          await ctx.commandPalette.requestConfirmation(`${label} “${session.title}”`, {
            description:
              kind === "archive"
                ? `The saved conversation is kept. ${archiveWork}`
                : "This cannot be undone. Workspace files and external agent history are kept.",
            buttonLabel: kind === "archive" ? "Archive" : "Delete",
            onConfirm: async () => {
              const preview = ctx.resources.preview.begin(session.resource, { removed: true });
              try {
                await ctx.resources.preview.persist(session.resource, () => getApiClient().sessions[kind](session.id));
                if (kind === "delete") getWriter("sessions")?.remove(session.id);
                else {
                  const row = getCollection("sessions").get(session.id);
                  if (row) getWriter("sessions")?.upsert({ ...row, archived: true });
                }
                await preview.commit();
              } catch (error) {
                preview.rollback();
                throw error;
              }
            },
          });
        },
      },
    );
  }
  ctx.layout.registerMenuItem(resourceContextMenuPath("session"), {
    commandId: dashboardCommandIds.renameSession,
    group: "kernel",
    order: 20,
    when: sessionWhen,
  });
  ctx.layout.registerMenuItem(resourceContextMenuPath("session"), {
    commandId: dashboardCommandIds.archiveSession,
    group: "kernel",
    order: 30,
    when: sessionWhen,
  });
  const deletion = { commandId: dashboardCommandIds.deleteSession, group: "kernel", order: 40, separatorBefore: true };
  ctx.layout.registerMenuItem(resourceContextMenuPath("session"), {
    ...deletion,
    when: idleWhen,
  });
  ctx.layout.registerMenuItem(resourceContextMenuPath("session"), {
    ...deletion,
    when: busyWhen,
    readOnly: true,
    description: "Stop active or queued work before deleting.",
  });
};
