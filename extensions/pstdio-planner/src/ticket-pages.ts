import { definePage, definePlacement, l10n, type ViewRef, workbenchModes } from "@pstdio/sdk/extensions";
import { REVIEW_REQUEST_ICON } from "./data/review-request-summary";
import { ticketDocumentPage, ticketRequestsPage } from "./data/ticket-page-target";
import { ticketResourceKind } from "./resource-kinds";

export const createTicketPages = (tickets: ViewRef, editor: ViewRef, requests: ViewRef) => {
  const ticketBoardPanel = definePlacement({
    id: "ticket-board",
    mode: workbenchModes.project,
    region: "side",
    item: { kind: "view", view: tickets, presence: "closed" },
    mountStrategy: "keep-mounted",
  });
  const ticketsPage = definePage({
    id: "tickets",
    title: l10n("kanbanRenderers.tickets.title", "Tickets"),
    icon: "square-kanban",
    path: "tickets",
    mode: workbenchModes.project,
    main: { kind: "view", presentation: "page", view: tickets, cardinality: "one" },
    panelView: ticketBoardPanel.ref,
    slots: [],
  });
  const ticketDetailPage = definePage({
    id: ticketDocumentPage.id,
    title: l10n("panels.ticketEditor.title", "Ticket"),
    icon: "component",
    path: ticketDocumentPage.path,
    document: ticketDocumentPage.document,
    mode: workbenchModes.project,
    parent: ticketsPage.ref,
    resource: { kinds: [ticketResourceKind.ref] },
    main: { kind: "view", presentation: "page", view: editor, cardinality: "one" },
    slots: [],
  });
  const requestsPage = definePage({
    id: ticketRequestsPage.id,
    title: l10n("requests.page.title", "Needs attention"),
    icon: REVIEW_REQUEST_ICON,
    parent: { kind: "page", id: "tickets" },
    path: "ticket-requests",
    mode: workbenchModes.project,
    resource: { kinds: [ticketResourceKind.ref] },
    main: { kind: "view", presentation: "page", view: requests, cardinality: "one" },
    slots: [],
  });
  return { ticketDetailPage, ticketsPage, ticketBoardPanel, requestsPage };
};
