import { eventRef } from "@pstdio/sdk/extensions";

export const catalog = [
  { id: "release", label: "Release checklist", description: "Review the steps for a small product release." },
  { id: "handoff", label: "Design handoff", description: "Review the details before handing a design to an engineer." },
];

export interface ReviewSettings {
  heading: string;
  showDetails: boolean;
}

export const getItem = (id: string) => {
  const item = catalog.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown review item: ${id}`);
  return item;
};

export const defaultSettings = (id: string) => ({ heading: getItem(id).label, showDetails: true });
export const settingsChanged = eventRef<{ id: string }>({
  extensionId: "examples.resource-reviewer",
  id: "settings.changed",
});
