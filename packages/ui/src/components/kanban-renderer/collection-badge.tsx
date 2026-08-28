import { Badge, Icon, Text } from "@chakra-ui/react";
import type { LucideIcon } from "lucide-react";
import * as lucideIcons from "lucide-react";

interface CollectionBadgeProps {
  label: string;
  icon?: string;
  overflowCount?: number;
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
  const { label, icon, overflowCount = 0, onClick } = props;
  const BadgeIcon = resolveIcon(icon);

  return (
    <Badge
      as="span"
      display="inline-flex"
      gap="2xs"
      alignItems="center"
      minW="0"
      maxW="100%"
      variant="subtle"
      bg={{ _light: "bg.muted", _dark: "bg.subtle" }}
      color="fg.muted"
      textStyle="label/XS/medium"
      cursor={onClick ? "pointer" : "default"}
      onClick={
        onClick
          ? (event) => {
              event.stopPropagation();
              onClick();
            }
          : undefined
      }
      data-testid="collection-badge"
    >
      {BadgeIcon ? <Icon as={BadgeIcon} boxSize="3.5" flexShrink={0} aria-hidden="true" /> : null}
      <Text as="span" textStyle="label/XS/medium" color="fg.muted" minW="0" maxW="10rem" truncate>
        {label}
      </Text>
      {overflowCount > 0 ? <Text as="span">+{overflowCount}</Text> : null}
    </Badge>
  );
};
