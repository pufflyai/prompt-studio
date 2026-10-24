export interface ReadingItem {
  id: string;
  title: string;
  read: boolean;
}

export const READING_ITEMS: ReadingItem[] = [
  { id: "welcome", title: "Welcome to Prompt Studio", read: false },
  { id: "reshape", title: "Tools you can reshape", read: false },
  { id: "first-tool", title: "Build your first tool", read: true },
];

export const PURPOSE_STEPS = [
  { label: "Describe it", reply: "A reading list, right beside these notes.", action: "Build this tool" },
  { label: "Use it", reply: "Reading list added to this project.", action: "Add an unread filter" },
  { label: "Change it", reply: "Unread filter added. Your reading list stays intact.", action: "Replay the build" },
];

export const PROJECT_NOTES = [
  "Collect a few ideas for a quieter workday.",
  "",
  "• Keep useful things beside my notes.",
  "• Try one small tool, then change it.",
  "",
  "Next: skim the reading list and mark what I have read.",
].join("\n");
