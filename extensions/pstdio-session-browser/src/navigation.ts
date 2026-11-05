import {
  defineCommand,
  l10n,
  params,
  type ResourceRef,
  sessionSlots,
  viewDataEvents,
  workbenchResourceKinds,
} from "@pstdio/sdk/extensions";
import { sessionBrowser } from "../refs";
import { draftResource, sessionResource, sessionTarget } from "./resource";

export const create = defineCommand({
  id: "new",
  title: l10n("commands.new", "New session"),
  cli: true,
  params: {
    workspaceId: params.text(),
    harnessId: params.text(),
    deviceId: params.text(),
    side: params.boolean(),
    replace: params.boolean(),
  },
  run(ctx, input) {
    const resource = draftResource(ctx.projectId, {
      ...input,
      workspaceId: input.workspaceId ?? (ctx.resource?.type === "workspace" ? ctx.resource.id : undefined),
      deviceId: input.deviceId ?? ctx.resource?.device?.id,
    });
    if (input.replace) {
      ctx.navigation.open({
        kind: "viewer",
        operation: "switch",
        from: ctx.resource,
        page: sessionBrowser.pages.draft,
        resource,
      });
      return;
    }
    ctx.navigation.open(
      input.side
        ? { kind: "panel", panel: sessionBrowser.panels.conversation, resource, open: "pin" }
        : { kind: "page", page: sessionBrowser.pages.draft, resource },
    );
  },
});
export const open = defineCommand({
  id: "open",
  title: l10n("commands.open", "Open session"),
  cli: true,
  params: {
    sessionId: params.text({ required: true, resolvedFrom: "resource" }),
    side: params.boolean(),
    replace: params.boolean(),
  },
  async run(ctx, input) {
    const session = await ctx.sessions.get(input.sessionId);
    if (!session) throw new Error("Session not found.");
    const resource = sessionResource(session, ctx.projectId);
    if (input.replace) {
      ctx.navigation.open({
        kind: "viewer",
        operation: "switch",
        from: ctx.resource,
        page: sessionBrowser.pages.session,
        resource,
      });
      return;
    }
    ctx.navigation.open(
      input.side
        ? { kind: "panel", panel: sessionBrowser.panels.conversation, resource, open: "preview" }
        : sessionTarget(resource),
    );
  },
});
export const rename = defineCommand({
  id: "rename",
  title: l10n("commands.rename", "Rename session"),
  cli: true,
  menus: [{ slot: sessionSlots.headerOverflow, group: "session", icon: "pencil" }],
  params: {
    sessionId: params.text({ required: true, resolvedFrom: "resource" }),
    title: params.text({ required: true }),
  },
  resourceMutation: { kind: "rename", resourceType: "session", idParam: "sessionId", labelParam: "title" },
  async run(ctx, input) {
    await ctx.sessions.rename(input.sessionId, input.title);
    await ctx.events.emit(viewDataEvents.sessionsChanged, { projectId: ctx.projectId });
  },
});
export const archive = defineCommand({
  id: "archive",
  menus: [{ slot: sessionSlots.headerOverflow, group: "session", icon: "archive" }],
  title: l10n("commands.archive", "Archive session"),
  cli: true,
  params: { sessionId: params.text({ required: true, resolvedFrom: "resource" }) },
  resourceMutation: { kind: "remove", resourceType: "session", idParam: "sessionId" },
  async run(ctx, input) {
    await ctx.sessions.archive(input.sessionId);
    await ctx.resources.removed({
      type: "session",
      id: input.sessionId,
      extensionId: "pstdio",
      projectId: ctx.projectId,
    });
  },
});
export const remove = defineCommand({
  id: "delete",
  menus: ["in_progress", "awaiting_input", "queued", "completed", "failed", "cancelled", "disconnected"].map(
    (status) => ({
      slot: sessionSlots.headerOverflow,
      group: "session",
      icon: "trash-2",
      when: { resourceType: [workbenchResourceKinds.session], metadata: { status } },
      ...(["in_progress", "awaiting_input", "queued"].includes(status)
        ? {
            disabledWhen: { metadata: { status } },
            disabledReason: l10n("actions.stopBeforeDelete", "Stop active or queued work before deleting."),
          }
        : {}),
    }),
  ),
  title: l10n("commands.delete", "Delete session"),
  cli: true,
  params: { sessionId: params.text({ required: true, resolvedFrom: "resource" }) },
  resourceMutation: { kind: "remove", resourceType: "session", idParam: "sessionId" },
  async run(ctx, input) {
    await ctx.sessions.delete(input.sessionId);
    await ctx.resources.removed({
      type: "session",
      id: input.sessionId,
      extensionId: "pstdio",
      projectId: ctx.projectId,
    });
  },
});
export const resolve = defineCommand({
  id: "resolve",
  title: "Resolve session",
  params: { resources: params.json<ResourceRef[]>() },
  async run(ctx, input) {
    const refs = input.resources ?? (ctx.resource ? [ctx.resource] : []);
    const result = await Promise.all(
      refs.map(async (ref) => {
        if (ref.type !== "session") return null;
        const session = await ctx.sessions.get(ref.id);
        if (!session || session.archived) return null;
        const resource = { ...ref, ...sessionResource(session, ctx.projectId) };
        return { resource, target: sessionTarget(resource) };
      }),
    );
    return input.resources ? result.filter((item) => item !== null) : (result[0]?.resource ?? null);
  },
});

export const fork = defineCommand({
  id: "fork",
  title: l10n("commands.fork", "Fork conversation"),
  cli: true,
  menus: ["in_progress", "awaiting_input", "queued", "completed", "failed", "cancelled", "disconnected"].map(
    (status) => ({
      slot: sessionSlots.headerOverflow,
      group: "session",
      icon: "git-fork",
      when: { metadata: { status } },
      ...(["in_progress", "awaiting_input", "queued"].includes(status)
        ? {
            disabledWhen: { metadata: { status } },
            disabledReason: l10n(
              "actions.waitBeforeFork",
              "Wait for pending work before forking the full conversation.",
            ),
          }
        : {}),
    }),
  ),
  params: { sessionId: params.text({ required: true, resolvedFrom: "resource" }), messageId: params.text() },
  async run(ctx, input) {
    const result = await ctx.sessions.fork(input.sessionId, input.messageId);
    ctx.navigation.open(sessionTarget(sessionResource(result, ctx.projectId)));
  },
});
export const stop = defineCommand({
  id: "stop",
  title: l10n("commands.stop", "Stop session"),
  cli: true,
  menus: ["in_progress", "awaiting_input", "queued"].map((status) => ({
    slot: sessionSlots.headerPrimary,
    icon: "square",
    when: { metadata: { status } },
  })),
  params: { sessionId: params.text({ required: true, resolvedFrom: "resource" }) },
  run: (ctx, input) => ctx.sessions.stop(input.sessionId),
});
export const switchOptions = defineCommand({
  id: "switch.options",
  title: l10n("commands.switchOptions", "Find sessions"),
  params: { search: params.text() },
  async run(ctx, input) {
    return (await ctx.sessions.query({ limit: 50, orderBy: "lastActivity", search: input.search || undefined })).items;
  },
});
export const switchConversation = defineCommand({
  id: "switch",
  title: l10n("commands.switch", "Switch session"),
  params: {
    search: params.text({ label: l10n("sessions.search", "Search sessions") }),
    sessionId: params.select({
      required: true,
      label: l10n("conversation.title", "Session"),
      options: {
        command: switchOptions.ref,
        valueField: "id",
        labelField: "title",
        params: { search: { kind: "param-value", key: "search" } },
      },
    }),
  },
  run: (ctx, input) => open.run(ctx, { sessionId: input.sessionId, replace: true }),
});
