import { Badge, HStack, Icon, Stack, Text, Wrap } from "@chakra-ui/react";
import type { DragEventHandler, ReactNode } from "react";
import { getIconComponent } from "@/components/icon-color-picker";
import type { WorkspaceBadgeProps } from "@/components/workspace-badge";
import { WorkspaceBadge } from "@/components/workspace-badge";
import { type AttributeBadge, getAttributeBadgeColorPalette } from "./data-renderer-helpers";

export interface DataRendererCardProps {
  title: string;
  badges?: AttributeBadge[];
  customSlots?: ReactNode[];
  workspaceBadge?: WorkspaceBadgeProps;
  isSelected?: boolean;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
  onClick?: () => void;
}

export const DataRendererCard = (props: DataRendererCardProps) => {
  const {
    title,
    badges = [],
    customSlots = [],
    workspaceBadge,
    isSelected = false,
    draggable,
    onDragStart,
    onDragEnd,
    onClick,
  } = props;

  const hasBadges = badges.length > 0 || customSlots.length > 0;
  const cursor = draggable ? "grab" : onClick ? "pointer" : "default";

  return (
    <Stack
      gap="xs"
      padding="sm"
      borderRadius="sm"
      borderWidth="1px"
      width="100%"
      background="bg"
      transition="box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out"
      _hover={{ borderColor: "border.blue", boxShadow: "mid" }}
      cursor={cursor}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      data-selected={isSelected ? "true" : undefined}
      data-testid="renderer-card"
    >
      <HStack align="start" gap="2xs" flexWrap="wrap" minW="0">
        <Text textStyle="label/S/regular" flex="1" minW="0" overflowWrap="anywhere">
          {title}
        </Text>
        {workspaceBadge ? <WorkspaceBadge {...workspaceBadge} /> : null}
      </HStack>

      {hasBadges && (
        <Wrap gap="2xs">
          {badges.map((badge) => (
            <Badge
              key={badge.attributeId}
              variant="subtle"
              colorPalette={getAttributeBadgeColorPalette(badge)}
              gap="2xs"
              textStyle="label/XS/medium"
            >
              {badge.icon ? (
                <Icon as={getIconComponent(badge.icon)} boxSize="3.5" color={`${badge.color ?? "gray"}.fg`} />
              ) : null}
              {badge.label}
            </Badge>
          ))}
          {customSlots}
        </Wrap>
      )}
    </Stack>
  );
};
