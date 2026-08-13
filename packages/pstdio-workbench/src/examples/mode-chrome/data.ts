export const chromeModes = {
  studio: { id: "mode-chrome.studio", label: "Studio", icon: "flask-conical" },
  board: { id: "mode-chrome.board", label: "Board", icon: "kanban" },
  library: { id: "mode-chrome.library", label: "Library", icon: "book-open" },
} as const;

export const chromeWidgetIds = {
  rail: "mode-chrome.rail",
  status: "mode-chrome.status",
  overview: "mode-chrome.overview",
  catalog: "mode-chrome.catalog",
  notes: "mode-chrome.notes",
  inspector: "mode-chrome.inspector",
  libraryPage: "mode-chrome.library-page",
  boardHost: "mode-chrome.board-host",
  boardColumns: "mode-chrome.board-columns",
  boardSwimlanes: "mode-chrome.board-swimlanes",
} as const;

export const chromeItemKind = "mode-chrome.item";

export const chromeItems = [
  { id: "item-1", label: "Sealed observation mirror", role: "observation", trust: 54 },
  { id: "item-2", label: "Turing session deck", role: "evaluation", trust: 91 },
  { id: "item-3", label: "Remote facility keycard", role: "access", trust: 12 },
];

export const chromeItemResource = (item: (typeof chromeItems)[number]) => ({
  kind: chromeItemKind,
  uri: `mode-chrome://item/${item.id}`,
  id: item.id,
  label: item.label,
  icon: "package-search",
});
