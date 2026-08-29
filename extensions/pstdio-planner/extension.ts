import {
  defineCommandPaletteResource,
  defineExtension,
  defineHook,
  defineSkill,
  defineTemplateType,
  l10n,
  packageAsset,
  sessionEvents,
} from "@pstdio/sdk/extensions";
import { plannerTemplates } from "./extension-assets";
import { plannerCommands } from "./src/commands";
import { queryTicketResources } from "./src/commands/query-ticket-resources";
import { templateCommands } from "./src/commands/template-commands";
import { findTicket } from "./src/data/resolve";
import { ticketRefFromLifecyclePayload } from "./src/data/workspace-ticket-link";
import { worktreeCreatedHook } from "./src/hooks/worktree-created";
import { notifyBlocked } from "./src/planner-notifications";
import { ticketStatuses } from "./src/ticket-status-provider";
import { createPlannerUi, plannerSettingsSection, ticketResourceKind } from "./src/ui-contributions";

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
      "automation.maxInProgress": {
        type: "number",
        scope: "project",
        default: 2,
        title: "Maximum in-progress tickets",
        description: "Hard cap used by autonomous planner implementation automation.",
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
  viewMenus: plannerUi.viewMenus,
  placements: plannerUi.placements,
  resourceKinds: [ticketResourceKind],
  resourceViews: plannerUi.resourceViews,
  navigationItems: plannerUi.navigationItems,
  settingsPanels: plannerUi.settingsPanels,
  statuses: [ticketStatuses],

  settingsSections: [plannerSettingsSection],

  hooks: [
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
