export type ShortcutScope = "global" | "ticket" | "workspace" | "overlay";

export type ShortcutBinding = string | string[];

export interface ShortcutDefinition {
  id:
    | "close-overlay"
    | "create-ticket"
    | "create-session"
    | "goto-ticket-list"
    | "open-command-palette"
    | "change-theme"
    | "open-shortcut-help";
  actionLabel: string;
  binding: ShortcutBinding;
  scope: ShortcutScope;
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  { id: "close-overlay", actionLabel: "Close overlay", binding: "Escape", scope: "overlay" },
  { id: "create-ticket", actionLabel: "Create ticket", binding: "Ctrl+Shift+C", scope: "global" },
  { id: "create-session", actionLabel: "Create session", binding: "Ctrl+Shift+S", scope: "global" },
  { id: "goto-ticket-list", actionLabel: "Go to tickets", binding: "Ctrl+Shift+T", scope: "global" },
  { id: "open-command-palette", actionLabel: "Command palette", binding: "Ctrl+Shift+P", scope: "global" },
  { id: "change-theme", actionLabel: "Change theme", binding: "Ctrl+Shift+K", scope: "global" },
  { id: "open-shortcut-help", actionLabel: "Keyboard shortcuts", binding: "Ctrl+Shift+H", scope: "global" },
];

const projectRoutePattern = /^\/projects\/[^/]+(?:\/|$)/;
const ticketRoutePattern = /^\/projects\/[^/]+\/tickets\/[^/]+(?:\/|$)/;
const workspaceRoutePattern = /^\/projects\/[^/]+\/tickets\/[^/]+\/workspaces\/[^/]+(?:\/|$)/;

export const getShortcutDefinition = (id: ShortcutDefinition["id"]) => {
  return SHORTCUT_DEFINITIONS.find((shortcut) => shortcut.id === id);
};

export const getActiveShortcutScopes = (pathname: string) => {
  if (!projectRoutePattern.test(pathname)) {
    return [] as ShortcutScope[];
  }

  const scopes: ShortcutScope[] = ["global"];

  if (ticketRoutePattern.test(pathname)) {
    scopes.push("ticket");
  }

  if (workspaceRoutePattern.test(pathname)) {
    scopes.push("workspace");
  }

  return scopes;
};

type EditableTarget = {
  tagName?: string | null;
  type?: string | null;
  isContentEditable?: boolean;
  parentElement?: EditableTarget | null;
};

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

export const isEditableEventTarget = (target: EventTarget | EditableTarget | null | undefined) => {
  if (!target || typeof target !== "object") {
    return false;
  }

  let candidate: EditableTarget | null | undefined = target as EditableTarget;

  while (candidate) {
    if (candidate.isContentEditable) {
      return true;
    }

    const tagName = candidate.tagName?.toUpperCase();
    if (tagName === "TEXTAREA" || tagName === "SELECT") {
      return true;
    }

    if (tagName === "INPUT") {
      const type = candidate.type?.toLowerCase() ?? "text";
      return !NON_TEXT_INPUT_TYPES.has(type);
    }

    candidate = candidate.parentElement;
  }

  return false;
};
