import { Badge, Icon, Text } from "@chakra-ui/react";
import type { LucideIcon } from "lucide-react";
import * as lucideIcons from "lucide-react";
import { Tooltip } from "../primitives/tooltip";

export interface CollectionBadgeProps {
  label: string;
  icon?: string;
  color?: string;
  tooltip?: string;
  onClick?: () => void;
}

const toPascalCase = (value: string) =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

const resolveIcon = (name: string | undefined) => {
  if (!name) return undefined;
  const pascalName = toPascalCase(name);
  for (const candidate of [name, pascalName, `${pascalName}Icon`]) {
    const component = (lucideIcons as Record<string, unknown>)[candidate];
    if (component && (typeof component === "function" || typeof component === "object")) {
      return component as LucideIcon;
    }
  }
  return undefined;
};

export const CollectionBadge = (props: CollectionBadgeProps) => {
  const { label, icon, color, tooltip, onClick } = props;
  const BadgeIcon = resolveIcon(icon);

  const content = (
    <>
      {BadgeIcon ? <Icon as={BadgeIcon} boxSize="3.5" flexShrink={0} aria-hidden="true" /> : null}
      <Text as="span" textStyle="label/XS/medium" minW="0" maxW="10rem" truncate>
        {label}
      </Text>
    </>
  );

  const sharedProps = {
    display: "inline-flex",
    gap: "2xs",
    alignItems: "center",
    minW: "0",
    maxW: "100%",
    variant: color ? "subtle" : "ticket",
    colorPalette: color ?? "gray",
    size: "sm",
    textStyle: "label/XS/medium",
    "data-testid": "collection-badge",
  } as const;

  const badge = onClick ? (
    <Badge asChild {...sharedProps} cursor="pointer">
      <button
        type="button"
        aria-label={tooltip}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
      >
        {content}
      </button>
    </Badge>
  ) : (
    <Badge as="span" {...sharedProps} cursor="default">
      {content}
    </Badge>
  );
  return tooltip ? <Tooltip content={tooltip}>{badge}</Tooltip> : badge;
};
