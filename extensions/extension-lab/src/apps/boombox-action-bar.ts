import { defineView, l10n } from "@pstdio/sdk/extensions";
import { readExampleState } from "../example-state";
import { updateState } from "../state-commands";
import { examplesChanged } from "../state-events";

const destinations = [
  { id: "home", label: l10n("boombox.home", "Home"), filter: "Home", icon: "House" },
  { id: "search", label: l10n("boombox.search", "Search"), filter: "Search", icon: "Search" },
  { id: "library", label: l10n("boombox.library", "Your library"), filter: "Your library", icon: "Library" },
  { id: "liked", label: l10n("boombox.liked", "Liked songs"), filter: "Liked songs", icon: "Heart" },
];

export const boomboxActionBar = defineView({
  id: "boombox-rail",
  title: l10n("boombox.library", "Your library"),
  body: {
    kind: "actionBar",
    refreshEvents: [examplesChanged],
    query: async (ctx) => {
      const state = await readExampleState(ctx.storage, "boombox");
      return {
        items: destinations.map((destination) => ({
          id: destination.id,
          label: destination.label,
          icon: destination.icon,
          selected: state.filter === destination.filter,
          action: {
            kind: "command" as const,
            target: {
              command: updateState.ref,
              params: {
                name: "boombox",
                changes: [
                  { path: ["filter"], value: destination.filter },
                  { path: ["query"], value: "" },
                ],
              },
            },
          },
        })),
      };
    },
  },
});
