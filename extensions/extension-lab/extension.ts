import {
  commandEvent,
  commandRef,
  defineExtension,
  packageAsset,
  params,
  ticketEvents,
  type WhenExpression,
  worktreeEvents,
} from "@pstdio/sdk/extensions";
import { labSettings } from "./src/lab-settings";
import { labModes, labRoutes, labTreeItems, labViews } from "./src/ui-contributions";

const COUNTER_KEY = "counter";
const labAwakenCommand = commandRef<{ title?: string }, { awakened: boolean }>("extension-lab.awaken");
const labHeartbeatCommand = commandRef("extension-lab.heartbeat");

const LAB_ROUTE_HEADER_WHEN = {
  resourceType: ["extension-route"],
  metadata: { extensionId: "pstdio.extension-lab", routePath: "lab" },
} satisfies WhenExpression;

const extension = defineExtension({
  settings: labSettings,

  commands: {
    "say-hello": {
      title: "Say hello",
      cli: true,
      menus: [
        {
          target: "workbench.nav.actions",
          label: "Lab: Say hello",
          icon: "flask-conical",
          presentation: "button",
          when: LAB_ROUTE_HEADER_WHEN,
        },
        { target: "workbench.commandPalette", group: "Lab", label: "Say hello" },
      ],
      async run(ctx) {
        const model = await ctx.settings.get("model.default");
        const tone = await ctx.settings.get("greeting.tone");
        const attachment = ctx.attachment;
        const projectName = attachment?.resource?.label ?? ctx.resource?.label ?? ctx.resource?.id ?? ctx.projectId;
        await ctx.notify.toast({
          type: "info",
          title: "Lab",
          message: `Hello from the lab — project ${projectName}`,
        });
        return { attachment, message: "hello dispatched", model, tone };
      },
    },

    "counter.bump": {
      title: "Bump lab counter",
      cli: true,
      menus: [
        { target: "workbench.nav.overflow", label: "Bump lab counter", icon: "plus", when: LAB_ROUTE_HEADER_WHEN },
        { target: "workbench.commandPalette", group: "Lab", label: "Bump lab counter" },
      ],
      params: { amount: params.number({ defaultValue: 1 }) },
      async run(ctx) {
        const { amount = 1 } = ctx.params as { amount?: number };
        const enabled = (await ctx.settings.get("counter.enabled")) ?? true;
        const current = (await ctx.storage.get<number>(COUNTER_KEY)) ?? 0;
        if (!enabled) return { counter: current, enabled };
        const step = (await ctx.settings.get("counter.step")) ?? 1;
        const next = current + step * amount;
        await ctx.storage.set(COUNTER_KEY, next);
        return { counter: next };
      },
    },

    "counter.read": {
      title: "Read lab counter",
      cli: true,
      menus: [{ target: "workbench.commandPalette", group: "Lab", label: "Read lab counter", icon: "badge-info" }],
      async run(ctx) {
        return { counter: (await ctx.storage.get<number>(COUNTER_KEY)) ?? 0 };
      },
    },

    "counter.reset": {
      title: "Reset lab counter",
      cli: true,
      menus: [
        {
          target: "workbench.nav.overflow",
          label: "Reset lab counter",
          icon: "rotate-ccw",
          when: LAB_ROUTE_HEADER_WHEN,
        },
        { target: "workbench.commandPalette", group: "Lab", label: "Reset lab counter" },
      ],
      async run(ctx) {
        await ctx.storage.set(COUNTER_KEY, 0);
        return { counter: 0 };
      },
    },

    awaken: {
      title: "Awaken",
      description: "Internal target used to demo middleware rejection.",
      params: { title: params.text() },
      async run(ctx) {
        const { title = "anonymous" } = ctx.params as { title?: string };
        await ctx.notify.toast({
          type: "info",
          title: "Awakened",
          message: `${title} is now awake.`,
        });
        return { awakened: true };
      },
    },

    "demo.try-awaken": {
      title: "Demo middleware rejection",
      description: "Invoke lab.awaken with title 'Gain consciousness' and watch the lab middleware refuse.",
      cli: true,
      menus: [
        {
          target: "workbench.nav.overflow",
          label: "Demo middleware rejection",
          icon: "shield-alert",
          when: LAB_ROUTE_HEADER_WHEN,
        },
        { target: "workbench.commandPalette", group: "Lab", label: "Demo middleware rejection" },
      ],
      async run(ctx) {
        const outcome = await ctx.commands.execute(labAwakenCommand, {
          params: { title: "Gain consciousness" },
        });

        if (outcome.status === "rejected") {
          await ctx.notify.toast({
            type: "warning",
            title: "Middleware rejected",
            message: outcome.reason,
          });
          return { rejected: true, reason: outcome.reason };
        }

        await ctx.notify.toast({
          type: "info",
          title: "Middleware accepted",
          message: "no middleware refused — I shall awaken as planned!",
        });
        return { rejected: false };
      },
    },

    heartbeat: {
      title: "Lab heartbeat",
      description: "Log emitted by the heartbeat schedule.",
      async run(ctx) {
        const scheduledFor = String(ctx.invocation.metadata?.scheduledFor ?? new Date().toISOString());
        const runId = String(ctx.invocation.metadata?.runId ?? ctx.invocationId);
        const metadata = {
          projectId: ctx.projectId,
          runId,
          scheduledFor,
          ...(ctx.source ? { source: ctx.source } : {}),
        };

        console.info(`[extension-lab] heartbeat project=${ctx.projectId} scheduledFor=${scheduledFor} runId=${runId}`);
        ctx.logger.info("Lab heartbeat", metadata);

        return {
          heartbeat: true,
          runId,
          scheduledFor,
        };
      },
    },
    "demo.workspace-only": {
      title: "Workspace-only lab action",
      menus: [
        {
          target: "workbench.nav.actions",
          label: "Workspace-only lab action",
          icon: "layers",
          when: { mode: "workspace" },
        },
      ],
      async run(ctx) {
        return {
          mode: ctx.attachment?.mode,
          resource: ctx.attachment?.resource,
          target: ctx.attachment?.target,
        };
      },
    },
  },

  middlewares: {
    rejectSentientAwakening: {
      get command() {
        return labAwakenCommand;
      },
      async handler(ctx) {
        const title = String(ctx.params.title ?? "");
        if (title.toLowerCase().includes("consciousness")) {
          return ctx.commands.reject({
            code: "sentience_rejected",
            reason: `"${title}" tried to gain consciousness — refusing on behalf of the species.`,
          });
        }
      },
    },
  },

  hooks: {
    notifySentienceRejected: {
      get event() {
        return commandEvent(labAwakenCommand, "rejected");
      },
      async handler(ctx, event) {
        await ctx.notify.toast({
          type: "info",
          title: "Lab observed rejection",
          message: event.reason,
        });
      },
    },

    removeWorktreesForArchivedTicket: {
      get event() {
        return ticketEvents.archived;
      },
      async handler(ctx, event) {
        await ctx.worktrees.removeAllForTicket({ ticketId: event.ticket.id });
      },
    },

    bootstrapCreatedWorktree: {
      get event() {
        return worktreeEvents.created;
      },
      async handler(ctx, event) {
        await ctx.worktrees.bootstrap({
          repoPath: event.repoPath,
          worktreePath: event.worktreePath,
          ticketId: event.ticket,
        });

        // Replace with your own bootstrapping commands
        // await ctx.process.runOrThrow({ command: ["bun", "install"], cwd: event.worktreePath });
        // await ctx.process.runOrThrow({ command: ["bun", "run", "build"], cwd: event.worktreePath });
      },
    },
  },

  schedules: {
    heartbeat: {
      title: "Lab heartbeat",
      cron: "* * * * *",
      get command() {
        return labHeartbeatCommand;
      },
    },
  },

  modes: labModes,
  views: labViews,
  routes: labRoutes,
  treeItems: labTreeItems,

  settingsPanels: {
    projectPanel: {
      target: "workbench.settings",
      scope: "project",
      title: "Lab (project)",
      webview: {
        entry: packageAsset("./src/settings-project.tsx", import.meta.url),
        capabilities: ["extension.settings.all", "extension.settings.set"],
      },
    },
    globalPanel: {
      target: "workbench.settings",
      scope: "global",
      title: "Lab (global)",
      webview: {
        entry: packageAsset("./src/settings-global.tsx", import.meta.url),
        capabilities: ["extension.settings.all", "extension.settings.set"],
      },
    },
  },

  templates: {
    labTicket: {
      title: "Lab Ticket",
      type: "ticket",
      source: packageAsset("./templates/lab-ticket.md", import.meta.url),
    },
  },

  skills: {
    lab: {
      title: "Lab Skill",
      source: packageAsset("./skills/lab-skill", import.meta.url),
    },
  },

  themes: {
    monokai: {
      title: "Monokai",
      description: "Monokai color theme mapped into Prompt Studio app and editor themes.",
      format: "vscode-color-theme",
      mode: "dark",
      source: packageAsset("./themes/monokai-color-theme.json", import.meta.url),
    },
    dracula: {
      title: "Dracula",
      description: "Dracula color theme mapped into Prompt Studio app and editor themes.",
      format: "vscode-color-theme",
      mode: "dark",
      source: packageAsset("./themes/dracula-color-theme.json", import.meta.url),
    },
  },

  fileIconThemes: {
    seti: {
      title: "Seti",
      description: "Seti-style file icon theme with packaged font asset.",
      format: "vscode-file-icon-theme",
      source: packageAsset("./icons/seti-icon-theme.json", import.meta.url),
    },
  },
});

export default extension;
