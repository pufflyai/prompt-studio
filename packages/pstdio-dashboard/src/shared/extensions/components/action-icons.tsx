import type { LucideIcon } from "lucide-react";
import * as lucideIcons from "lucide-react";
import { createElement } from "react";

export type HeaderActionIcon = LucideIcon | string;
type HeaderActionIconSize = number | string;

const toPascalCase = (value: string) =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

export const resolveHeaderActionIcon = (icon: HeaderActionIcon | undefined) => {
  if (!icon) return undefined;
  if (typeof icon !== "string") return icon;

  const pascalName = toPascalCase(icon);
  const candidates = [icon, pascalName, `${pascalName}Icon`];

  for (const candidate of candidates) {
    const IconComponent = (lucideIcons as Record<string, unknown>)[candidate];
    if (IconComponent && (typeof IconComponent === "function" || typeof IconComponent === "object")) {
      return IconComponent as LucideIcon;
    }
  }

  return undefined;
};

export const renderHeaderActionIcon = (icon: HeaderActionIcon | undefined, boxSize: HeaderActionIconSize = "16px") => {
  const IconComponent = resolveHeaderActionIcon(icon);
  return IconComponent ? createElement(IconComponent, { size: boxSize, "aria-hidden": true }) : null;
};
