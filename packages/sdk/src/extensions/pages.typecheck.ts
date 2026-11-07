import { definePage, defineResourceKind, defineView, workbenchModes, workbenchPages } from "./index";

const ticket = defineResourceKind({ id: "ticket" });
const view = defineView({
  id: "ticket",
  title: "Ticket",
  body: { kind: "controls", query: async () => ({ values: {} }) },
});
const base = { id: "tickets", title: "Tickets", path: "tickets", mode: workbenchModes.project };
definePage({ ...base, main: { kind: "view", view: view.ref, cardinality: "one" }, slots: [] });
// @ts-expect-error A routed resource view needs a parent destination when its last tab closes.
definePage({
  ...base,
  resource: { kinds: [ticket.ref] },
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
// @ts-expect-error Multiple routed views require a resource constraint.
definePage({ ...base, main: { kind: "view", view: view.ref, cardinality: "many" }, slots: [] });
const page = definePage({
  ...base,
  parent: workbenchPages.start,
  resource: { kinds: [ticket.ref] },
  main: { kind: "view", view: view.ref, cardinality: "many" },
  slots: [{ id: "inspector", region: "side", item: { kind: "view", view: view.ref, presence: "closed" } }],
});
void page.panels.inspector;
// @ts-expect-error Generated references contain only declared slot names.
void page.panels.unknown;
definePage({ ...base, resource: { kinds: [ticket.ref] }, main: { kind: "panels", empty: view.ref }, slots: [] });
