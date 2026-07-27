export const paletteResourcesSource = `import type {
  CommandPaletteResourceResult,
  WorkbenchModuleContribution,
} from "@pstdio/workbench";

const tickets = [
  { id: "PS-101", label: "Palette resource providers" },
  { id: "PS-118", label: "Extension search bridge" },
];

export const createPaletteResourcesModule = (): WorkbenchModuleContribution => ({
  id: "docs.palette-resources",
  activate(ctx) {
    ctx.commandPaletteResources.registerProvider({
      id: "docs.tickets",
      title: "Tickets",
      query: ({ query, limit }) =>
        tickets
          .filter((ticket) =>
            ticket.label.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, limit)
          .map(
            (ticket): CommandPaletteResourceResult => ({
              id: ticket.id,
              label: ticket.label,
              icon: "Ticket",
              activate: () =>
                ctx.resources.openResource({
                  kind: "ticket",
                  uri: \`ticket:\${ticket.id}\`,
                  id: ticket.id,
                  label: ticket.label,
                }),
            }),
          ),
    });

    ctx.commandPaletteResources.registerProvider({
      id: "docs.actions",
      title: "Actions",
      query: () => [
        {
          id: "create-ticket",
          label: "Create ticket",
          icon: "Plus",
          activate: () =>
            ctx.notifications.show({ level: "success", title: "Ticket draft created" }),
        },
      ],
    });
  },
});`;
