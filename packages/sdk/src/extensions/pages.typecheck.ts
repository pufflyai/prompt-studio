import {
  definePage,
  defineResourceKind,
  defineView,
  type PagePrimarySlot,
  workbenchModes,
  workbenchPages,
} from "./index";

const ticket = defineResourceKind({ id: "ticket" });
const view = defineView({
  id: "ticket",
  title: "Ticket",
  body: { kind: "controls", query: async () => ({ values: {} }) },
});
const base = { id: "tickets", title: "Tickets", path: "tickets", mode: workbenchModes.project };

definePage({
  ...base,
  slots: [
    // @ts-expect-error a primary slot needs content
    { id: "content", role: "primary", region: "main" },
  ],
});
definePage({
  ...base,
  slots: [
    // @ts-expect-error routed primary content belongs in main
    { id: "content", role: "primary", region: "side", view: view.ref },
  ],
});
// @ts-expect-error a resource page needs a last-tab close destination
definePage({
  ...base,
  slots: [
    {
      id: "content",
      role: "primary",
      region: "main",
      binding: { kind: ticket.ref, view: view.ref, cardinality: "one" },
    },
  ],
});

definePage({
  ...base,
  parent: workbenchPages.start,
  slots: [
    {
      id: "content",
      role: "primary",
      region: "main",
      binding: { kind: ticket.ref, view: view.ref, cardinality: "one" },
    },
  ],
});
// @ts-expect-error a primary slot declares exactly one content source
const ambiguousPrimary: PagePrimarySlot = {
  id: "content",
  role: "primary",
  region: "main",
  view: view.ref,
  binding: { kind: ticket.ref, view: view.ref, cardinality: "one" as const },
};
void ambiguousPrimary;
