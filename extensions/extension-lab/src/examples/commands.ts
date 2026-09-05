import {
  defineCommand,
  defineExtension,
  defineResourceKind,
  params,
  resourceMenuSlotRef,
} from "@pstdio/sdk/extensions";

const ticket = defineResourceKind({
  id: "example-ticket",
  menuSlots: [{ id: "header-actions", placement: "header-primary", access: "owner" }],
});
const createTicket = defineCommand({
  id: "example-create-ticket",
  title: "Create example ticket",
  cli: {
    path: ["example", "create-ticket"],
    examples: ['pst extension-lab example create-ticket --title "Review the API"'],
  },
  params: { title: params.text({ label: "Title", required: true }) },
  async run(_ctx, input) {
    return { title: input.title };
  },
});
const runAttempt = defineCommand({
  id: "example-run-attempt",
  title: "Run attempt",
  menus: [
    {
      slot: resourceMenuSlotRef(ticket.ref, "header-actions"),
      label: "Run attempt",
      icon: "play",
      presentation: "button",
    },
  ],
  async run(ctx) {
    return { ticket: ctx.resource?.id };
  },
});
export default defineExtension({ resourceKinds: [ticket], commands: [createTicket, runAttempt] });
