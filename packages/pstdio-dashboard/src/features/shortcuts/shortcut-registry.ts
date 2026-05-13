export type ShortcutScope = "global" | "ticket" | "workspace" | "overlay";

export type ShortcutBinding = string | string[];

const projectRoutePattern = /^\/projects\/[^/]+(?:\/|$)/;
const ticketRoutePattern = /^\/projects\/[^/]+\/tickets\/[^/]+(?:\/|$)/;
const workspaceRoutePattern = /^\/projects\/[^/]+\/tickets\/[^/]+\/workspaces\/[^/]+(?:\/|$)/;

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
