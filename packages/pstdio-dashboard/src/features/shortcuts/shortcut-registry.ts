export type ShortcutScope = "global" | "ticket" | "workspace" | "overlay";

export type ShortcutBinding = string | string[];

export interface ShortcutDefinition {
  id:
    | "close-overlay"
    | "create-ticket"
    | "create-session"
    | "goto-ticket-list"
    | "nav-previous"
    | "nav-next"
    | "open-shortcut-help";
  actionLabel: string;
  binding: ShortcutBinding;
  scope: ShortcutScope;
  whenNotTyping?: boolean;
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  { id: "close-overlay", actionLabel: "Close overlay", binding: "Escape", scope: "overlay" },
  { id: "create-ticket", actionLabel: "Create ticket", binding: "C", scope: "global", whenNotTyping: true },
  { id: "create-session", actionLabel: "Create session", binding: "S", scope: "global", whenNotTyping: true },
  { id: "goto-ticket-list", actionLabel: "Go to tickets", binding: ["G", "T"], scope: "global", whenNotTyping: true },
  { id: "nav-previous", actionLabel: "Previous item", binding: "[", scope: "ticket", whenNotTyping: true },
  { id: "nav-next", actionLabel: "Next item", binding: "]", scope: "ticket", whenNotTyping: true },
  {
    id: "open-shortcut-help",
    actionLabel: "Keyboard shortcuts",
    binding: "Shift+/",
    scope: "global",
    whenNotTyping: true,
  },
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

  const editableTarget = target as EditableTarget;
  if (editableTarget.isContentEditable) {
    return true;
  }

  const tagName = editableTarget.tagName?.toUpperCase();
  if (tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }

  if (tagName !== "INPUT") {
    return false;
  }

  const type = editableTarget.type?.toLowerCase() ?? "text";
  return !NON_TEXT_INPUT_TYPES.has(type);
};
