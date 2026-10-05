import { defineView, type NavigationTarget } from "@pstdio/sdk/extensions";
import { pageRef, settingsSection } from "../store";

export const sections = [
  { id: "research", label: "Research", icon: "Telescope" },
  { id: "voice", label: "Voice", icon: "PenLine" },
  { id: "channels", label: "Channels", icon: "RadioTower" },
] as const;
export type SectionId = (typeof sections)[number]["id"];
type Section = (typeof sections)[number];
export const sectionOf = (resource?: { id: string }) =>
  sections.find((section) => section.id === resource?.id)?.id ?? "research";
export const sectionTarget = (section: Section = sections[0]) =>
  ({
    kind: "page",
    page: pageRef("settings"),
    resource: { type: settingsSection.id, id: section.id, label: section.label },
  }) satisfies NavigationTarget;

/** Lists the settings sections beside the settings view; each row opens the page on its section. */
export const settingsMenu = defineView({
  id: "settings-menu",
  title: "Settings sections",
  body: {
    kind: "tree",
    body: (_ctx, { renderer }) => [
      {
        id: "sections",
        collapsible: false,
        nodes: sections.map((section) => {
          const target = sectionTarget(section);
          return {
            id: section.id,
            label: section.label,
            icon: section.icon,
            resource: target.resource,
            target,
            selected: section.id === sectionOf(renderer.resource),
          };
        }),
      },
    ],
  },
});
