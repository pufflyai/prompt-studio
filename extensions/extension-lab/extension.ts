import { commandEvent, commandsOf, defineExtension, packageAsset, params, projectSlots } from "@pstdio/sdk/extensions";

const COUNTER_KEY = "counter";

const extension = defineExtension({
  id: "pstdio.extension-lab",
  namespace: "lab",
  name: "Extension Lab",
  version: "0.1.0",
  apiVersion: "1",
  description: "Sandbox for trying out the extension API. Depends only on kernel-owned slots and events.",

  commands: {
    "say-hello": {
      title: "Say hello",
      cli: true,
      menus: [{ slot: projectSlots.headerPrimary, label: "Lab: Say hello" }],
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
      menus: [{ slot: projectSlots.headerOverflow, label: "Bump lab counter" }],
      params: { amount: params.number({ defaultValue: 1 }) },
      async run(ctx) {
        const current = (await ctx.storage.get<number>(COUNTER_KEY)) ?? 0;
        const next = current + (ctx.params.amount ?? 1);
        await ctx.storage.set(COUNTER_KEY, next);
        return { counter: next };
      },
    },

    "counter.read": {
      title: "Read lab counter",
      cli: true,
      async run(ctx) {
        return { counter: (await ctx.storage.get<number>(COUNTER_KEY)) ?? 0 };
      },
    },

    "counter.reset": {
      title: "Reset lab counter",
      cli: true,
      menus: [{ slot: projectSlots.headerOverflow, label: "Reset lab counter" }],
      async run(ctx) {
        await ctx.storage.set(COUNTER_KEY, 0);
        return { counter: 0 };
      },
    },

    awaken: {
      title: "Awaken",
      description: "Internal target used to demo middleware rejection.",
      commandPanel: false,
      params: { title: params.text() },
      async run(ctx) {
        const title = ctx.params.title ?? "anonymous";
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
      menus: [{ slot: projectSlots.headerOverflow, label: "Demo middleware rejection" }],
      async run(ctx) {
        const outcome = await ctx.commands.execute(labCommands.awaken, {
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
      commandPanel: false,
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
        return labCommands.awaken;
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
        return commandEvent(labCommands.awaken, "rejected");
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
        return labCommands.heartbeat;
      },
    },
  },

  routes: {
    labPage: {
      path: "lab",
      label: "Lab",
      webview: {
        entry: packageAsset("./dist/lab-page.html", import.meta.url),
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
});

const labCommands = commandsOf(extension);

export default extension;
