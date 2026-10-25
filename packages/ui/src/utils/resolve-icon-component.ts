import type { LucideIcon } from "lucide-react";
import * as lucideIcons from "lucide-react";
import { optionIcons } from "@/components/primitives/icon-options";
import { MessagesCircle } from "./messages-circle-icon";

const toPascalCase = (value: string) =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

export const resolveIconComponent = (name: string) => {
  const option = optionIcons.find((option) => option.value === name);
  if (option) return option.icon;
  const pascalName = toPascalCase(name);
  if (pascalName === "MessagesCircle") return MessagesCircle;
  for (const candidate of [name, pascalName, `${pascalName}Icon`]) {
    const component = (lucideIcons as Record<string, unknown>)[candidate];
    if (component && (typeof component === "function" || typeof component === "object")) return component as LucideIcon;
  }
  return undefined;
};
