import {
  defineCommandPaletteResource,
  defineExtension,
  defineHook,
  defineKeybinding,
  defineSkill,
  defineTemplateType,
  l10n,
  packageAsset,
  sessionEvents,
} from "@pstdio/sdk/extensions";
import { plannerTemplates } from "./extension-assets";
import { plannerCommands } from "./src/commands";
import { mergedPullRequestsSchedule } from "./src/commands/check-merged-pull-requests";
import { implementationTargetsCommand } from "./src/commands/implementation-targets";
import { newTicketCommand } from "./src/commands/new-ticket";
import { openTicketsCommand } from "./src/commands/open-tickets";
import { queryTicketResources } from "./src/commands/query-ticket-resources";
import { templateCommands } from "./src/commands/template-commands";
import { findTicket } from "./src/data/resolve";
import { ticketRefFromLifecyclePayload } from "./src/data/workspace-ticket-link";
import { gitMergedHook } from "./src/hooks/git-merged";
import { worktreeCreatedHook } from "./src/hooks/worktree-created";
import { notifyBlocked } from "./src/planner-notifications";
import { ticketStatuses } from "./src/ticket-status-provider";
import { createPlannerUi, ticketResourceKind } from "./src/ui-contributions";

const plannerUi = createPlannerUi(import.meta.url);

const templateCommandRefs = {
  list: templateCommands.list.ref,
  read: templateCommands.read.ref,
  save: templateCommands.save.ref,
  delete: templateCommands.delete.ref,
};

export default defineExtension({
  settings: {
    properties: {
      "tickets.deleteLinkedWorkspaces": {
        type: "boolean",
        scope: "project",
        default: true,
        title: l10n("settings.tickets.deleteLinkedWorkspaces.title", "Delete linked workspaces"),
        description: l10n(
          "settings.tickets.deleteLinkedWorkspaces.description",
          "When a ticket is archived or deleted, delete its workspaces once no active ticket uses them. This removes the worktree, its branch, and any uncommitted changes.",
        ),
      },
      "tickets.markDoneOnMerge": {
        type: "boolean",
        scope: "project",
        default: true,
        title: l10n("settings.tickets.markDoneOnMerge.title", "Mark done on merge"),
        description: l10n(
          "settings.tickets.markDoneOnMerge.description",
          "Move a ticket to Done when its workspace branch or linked pull request is merged.",
        ),
      },

      "refinement.generateArtifactPrototype": {
        type: "boolean",
        scope: "project",
        default: true,
        title: l10n("settings.uxPrototype.title", "Generate an artifact prototype for UX features"),
        description: l10n(
          "settings.uxPrototype.description",
          "Require an interactive prototype when refining a new UX feature if Artifacts is available.",
        ),
      },
      "implementation.adversarialReview": {
        type: "boolean",
        scope: "project",
        default: true,
        title: l10n("settings.implementation.adversarialReview.title", "Adversarial review"),
        description: l10n(
          "settings.implementation.adversarialReview.description",
          "Run an adversarial review before finishing ticket implementation.",
        ),
      },
      "implementation.openPr": {
        type: "boolean",
        scope: "project",
        default: true,
        title: l10n("settings.implementation.openPr.title", "Open PR"),
        description: l10n(
          "settings.implementation.openPr.description",
          "Open a draft pull request when the change is ready and link it to the ticket.",
        ),
      },
      "automation.maxInProgress": {
        type: "number",
        scope: "project",
        default: 2,
        title: "Maximum in-progress tickets",
        description:
          "Most tickets with a running implementation at once. At this limit, Run attempt does not start another ticket, whether automation or a person runs it.",
      },
      "implementation.defaultTargetBranch": {
        type: "string",
        scope: "project",
        default: "",
        title: l10n("settings.implementation.defaultTargetBranch.title", "Default target branch"),
        description: l10n(
          "settings.implementation.defaultTargetBranch.description",
          "Remote branch that new work targets. Clear it to use the repository default branch.",
        ),
        options: { command: implementationTargetsCommand.ref, valueField: "branch", labelField: "branch" },
      },
    },
  },

  defaultLocale: "en",
  translations: {
    es: packageAsset("./l10n/es.json", import.meta.url),
    fr: packageAsset("./l10n/fr.json", import.meta.url),
    ja: packageAsset("./l10n/ja.json", import.meta.url),
    ko: packageAsset("./l10n/ko.json", import.meta.url),
    "zh-Hans": packageAsset("./l10n/zh-Hans.json", import.meta.url),
    "zh-Hant": packageAsset("./l10n/zh-Hant.json", import.meta.url),
  },

  commands: plannerCommands,
  views: plannerUi.views,
  pages: plannerUi.pages,
  viewMenus: plannerUi.viewMenus,
  resourceKinds: [ticketResourceKind],
  navigationItems: plannerUi.navigationItems,
  keybindings: [
    defineKeybinding({
      id: "open-tickets",
      key: "Alt+Shift+P",
      action: { kind: "command", target: { command: openTicketsCommand.ref } },
    }),
    defineKeybinding({
      id: "new-ticket",
      key: "Mod+Alt+P",
      action: { kind: "command", target: { command: newTicketCommand.ref } },
    }),
  ],
  navigationTrees: plannerUi.navigationTrees,
  settingsPanels: plannerUi.settingsPanels,
  statuses: [ticketStatuses],

  schedules: [mergedPullRequestsSchedule],
  hooks: [
    gitMergedHook,
    worktreeCreatedHook,
    defineHook({
      id: "session-awaiting-input",
      event: sessionEvents.awaitingInput,
      async run(ctx, payload) {
        const ticketRef = ticketRefFromLifecyclePayload(payload);
        const ticket = ticketRef ? await findTicket(ctx.storage, ticketRef) : null;
        if (ticket) await notifyBlocked(ctx, ticket, payload.sessionId);
      },
    }),
  ],

  commandPaletteResources: [
    defineCommandPaletteResource({
      id: "tickets",
      title: l10n("commandPaletteResources.tickets.title", "Tickets"),
      resourceKind: ticketResourceKind.ref,
      query: queryTicketResources,
    }),
  ],

  templateTypes: [
    defineTemplateType({
      id: "ticket",
      label: "Ticket",
      description: "Ticket templates",
      order: 10,
      commands: templateCommandRefs,
    }),
    defineTemplateType({
      id: "prompt",
      label: "Prompt",
      description: "Prompt templates",
      order: 20,
      commands: templateCommandRefs,
    }),
    defineTemplateType({
      id: "document",
      label: "Document",
      description: "Document templates",
      order: 30,
      commands: templateCommandRefs,
    }),
  ],

  templates: plannerTemplates,

  skills: [
    defineSkill({
      id: "create-proposal",
      title: "Create a proposal",
      source: packageAsset("./skills/create-proposal", import.meta.url),
    }),
    defineSkill({
      id: "create-sub-tickets",
      title: "Create sub-tickets",
      source: packageAsset("./skills/create-sub-tickets", import.meta.url),
    }),
    defineSkill({
      id: "create-ticket",
      title: "Create a ticket",
      source: packageAsset("./skills/create-ticket", import.meta.url),
    }),
    defineSkill({
      id: "implement-ticket",
      title: "Implement a ticket",
      source: packageAsset("./skills/implement-ticket", import.meta.url),
    }),
    defineSkill({
      id: "refine-ticket",
      title: "Refine a ticket",
      source: packageAsset("./skills/refine-ticket", import.meta.url),
    }),
  ],
});
