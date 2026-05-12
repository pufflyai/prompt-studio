import { commandEvent, commandRef, defineExtension, packageAsset, params, projectSlots } from "@pstdio/sdk/extensions";

const COUNTER_KEY = "counter";
const labAwakenCommand = commandRef<{ title?: string }, { awakened: boolean }>("extension-lab.awaken");
const labHeartbeatCommand = commandRef("extension-lab.heartbeat");

const extension = defineExtension({
  commands: {
    "say-hello": {
      title: "Say hello",
      cli: true,
      menus: [
        { slot: projectSlots.headerPrimary, label: "Lab: Say hello" },
        { slot: projectSlots.commandPanel, label: "Say hello" },
      ],
      async run(ctx) {
        const projectName = ctx.resource?.label ?? ctx.resource?.id ?? ctx.projectId;
        await ctx.notify.toast({
          type: "info",
          title: "Lab",
          message: `Hello from the lab — project ${projectName}`,
        });
        return { message: "hello dispatched" };
      },
    },

    "counter.bump": {
      title: "Bump lab counter",
      cli: true,
      menus: [
        { slot: projectSlots.headerOverflow, label: "Bump lab counter" },
        { slot: projectSlots.commandPanel, label: "Bump lab counter" },
      ],
      params: { amount: params.number({ defaultValue: 1 }) },
      async run(ctx) {
        const { amount = 1 } = ctx.params as { amount?: number };
        const current = (await ctx.storage.get<number>(COUNTER_KEY)) ?? 0;
        const next = current + amount;
        await ctx.storage.set(COUNTER_KEY, next);
        return { counter: next };
      },
    },

    "counter.read": {
      title: "Read lab counter",
      cli: true,
      menus: [{ slot: projectSlots.commandPanel, label: "Read lab counter" }],
      async run(ctx) {
        return { counter: (await ctx.storage.get<number>(COUNTER_KEY)) ?? 0 };
      },
    },

    "counter.reset": {
      title: "Reset lab counter",
      cli: true,
      menus: [
        { slot: projectSlots.headerOverflow, label: "Reset lab counter" },
        { slot: projectSlots.commandPanel, label: "Reset lab counter" },
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
        { slot: projectSlots.headerOverflow, label: "Demo middleware rejection" },
        { slot: projectSlots.commandPanel, label: "Demo middleware rejection" },
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
      description: "Toast emitted by the heartbeat schedule.",
      async run(ctx) {
        await ctx.notify.toast({
          type: "info",
          title: "Lab heartbeat",
          message: `Schedule fired at ${new Date().toISOString()}`,
        });
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

  routes: {
    labPage: {
      path: "lab",
      label: "Lab",
      webview: {
        entry: packageAsset("./src/main.tsx", import.meta.url),
      },
    },
    faultyPage: {
      path: "lab-faulty",
      label: "Lab (faulty)",
      webview: {
        entry: packageAsset("./src/faulty-main.tsx", import.meta.url),
      },
    },
  },

  navigation: {
    labPage: {
      slot: projectSlots.sidebarNav,
      label: "Lab",
      icon: "flask-conical",
      route: "lab",
    },
    faultyPage: {
      slot: projectSlots.sidebarNav,
      label: "Lab (faulty)",
      icon: "flask-conical-off",
      route: "lab-faulty",
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
