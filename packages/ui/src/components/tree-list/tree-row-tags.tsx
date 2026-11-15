import { Badge, HStack, Icon, Stack, Text, VisuallyHidden } from "@chakra-ui/react";
import type { TreeNodeTag } from "@pstdio/sdk/extensions";
import { getIconComponent } from "../primitives/icon-options";
import { Tooltip } from "../primitives/tooltip";

export interface TreeRowTagsProps {
  tags?: TreeNodeTag[];
  /** The trailing count badge stays after the tags. */
  badge?: { label: string; color?: string };
  /** Tags shown before the rest collapse into "+N". */
  maxVisible?: number;
}

interface TreeRowTagProps {
  tag: TreeNodeTag;
}

// Plain badges, not interactive collection badges: a click on a tag must still activate the row.
const TreeRowTag = (props: TreeRowTagProps) => {
  const { tag } = props;
  const badge = (
    <Badge
      size="sm"
      variant={tag.color ? "subtle" : "ticket"}
      colorPalette={tag.color ?? "gray"}
      display="inline-flex"
      alignItems="center"
      gap="2xs"
      minW="0"
      maxW="6rem"
      flexShrink={1}
    >
      {tag.icon ? <Icon as={getIconComponent(tag.icon)} boxSize="3" flexShrink={0} aria-hidden="true" /> : null}
      <Text as="span" textStyle="label/XS/medium" minW="0" truncate>
        {tag.label}
      </Text>
    </Badge>
  );
  return tag.tooltip ? <Tooltip content={tag.tooltip}>{badge}</Tooltip> : badge;
};

/**
 * Display-only tags for a tree row, before its count badge. Tags beyond `maxVisible` collapse into
 * "+N"; its tooltip lists them for pointer users and hidden text names them for screen readers.
 */
export const TreeRowTags = (props: TreeRowTagsProps) => {
  const { tags = [], badge, maxVisible = 2 } = props;
  if (tags.length === 0 && !badge) return null;
  const visible = tags.slice(0, maxVisible);
  const hidden = tags.slice(maxVisible);

  return (
    <HStack gap="2xs" minW="0" overflow="hidden">
      {visible.map((tag) => (
        <TreeRowTag key={tag.id} tag={tag} />
      ))}
      {hidden.length > 0 ? (
        <Tooltip
          content={
            <Stack gap="2xs">
              {hidden.map((tag) => (
                <Text key={tag.id} textStyle="label/XS/regular">
                  {tag.label}
                </Text>
              ))}
            </Stack>
          }
        >
          <Badge size="sm" variant="ticket" colorPalette="gray" flexShrink={0}>
            <span aria-hidden="true">+{hidden.length}</span>
            <VisuallyHidden>{hidden.map((tag) => tag.label).join(", ")}</VisuallyHidden>
          </Badge>
        </Tooltip>
      ) : null}
      {badge ? (
        <Badge size="sm" variant="subtle" colorPalette={badge.color ?? "gray"} flexShrink={0}>
          {badge.label}
        </Badge>
      ) : null}
    </HStack>
  );
};
