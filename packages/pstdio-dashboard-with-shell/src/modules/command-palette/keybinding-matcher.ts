type Modifier = "Ctrl" | "Shift" | "Alt" | "Meta";

const MODIFIER_SET: ReadonlySet<Modifier> = new Set(["Ctrl", "Shift", "Alt", "Meta"]);

interface ParsedKeybinding {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
}

const isModifierToken = (token: string): token is Modifier => MODIFIER_SET.has(token as Modifier);

export const parseKeybinding = (binding: string): ParsedKeybinding | null => {
  const parts = binding
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const result: ParsedKeybinding = { ctrl: false, shift: false, alt: false, meta: false, key: "" };

  for (const part of parts) {
    if (isModifierToken(part)) {
      if (part === "Ctrl") result.ctrl = true;
      else if (part === "Shift") result.shift = true;
      else if (part === "Alt") result.alt = true;
      else result.meta = true;
      continue;
    }

    if (result.key) return null;
    result.key = part.toLowerCase();
  }

  if (!result.key) return null;
  return result;
};

interface KeybindingEvent {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  key: string;
}

export const matchesKeybinding = (binding: string, event: KeybindingEvent) => {
  const parsed = parseKeybinding(binding);
  if (!parsed) return false;

  return (
    parsed.ctrl === event.ctrlKey &&
    parsed.shift === event.shiftKey &&
    parsed.alt === event.altKey &&
    parsed.meta === event.metaKey &&
    parsed.key === event.key.toLowerCase()
  );
};
