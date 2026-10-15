import { registerBoomboxExample } from "../showcases/boombox";
import { registerKilnExample } from "../showcases/kiln";
import { registerKilnSessions } from "../showcases/kiln-sessions";
import { createWindowingFixture } from "./fixture";
import { windowingExtensionId } from "./resources";

export const integratedLongNote = {
  type: "windowing.note",
  id: "long-note",
  extensionId: windowingExtensionId,
  label: "Release planning notes with a deliberately long resource name.md",
};

export const integratedTicketPage = { kind: "page", extensionId: windowingExtensionId, id: "bound-ticket" } as const;
export const integratedTickets = ["A", "B"].map((letter) => ({
  type: "windowing.ticket",
  extensionId: windowingExtensionId,
  id: `ticket-${letter.toLowerCase()}`,
  label: `Ticket ${letter}`,
}));

export const createIntegratedWindowingFixture = () => {
  const fixture = createWindowingFixture("windowing", {
    pagePanels: true,
    contextNavigation: true,
    registerPages: (workbench) => {
      registerBoomboxExample(workbench);
      registerKilnExample(workbench);
      registerKilnSessions(workbench);
      workbench.resources.registerKind({ kind: "windowing.ticket", label: "Ticket" });
      workbench.resources.registerProvider({
        id: "windowing.ticket",
        kind: "windowing.ticket",
        list: () => integratedTickets.map((resource) => ({ resource })),
      });
      workbench.pages.registerPage({
        id: "windowing.bound-ticket",
        ref: integratedTicketPage,
        title: "Ticket",
        path: "windowing/tickets/resource",
        parentId: "windowing.ticket",
        modeId: "windowing",
        resource: { kinds: [{ kind: "resource-kind", id: "windowing.ticket" }] },
        main: { kind: "view", view: { kind: "view", id: "windowing.proposal" }, cardinality: "one" },
        panelMenus: { right: { view: { kind: "view", id: "windowing.inspector" }, size: { defaultPx: 240 } } },
        slots: [],
      });
    },
  });
  fixture.resources.notes.push(integratedLongNote);
  return fixture;
};
