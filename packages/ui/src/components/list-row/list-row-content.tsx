import { Box, HStack, Icon, IconButton, Stack, Text, useRecipe } from "@chakra-ui/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Tooltip } from "@/components/primitives/tooltip";
import type { ListRowItem, ListRowProps, RowContentProps } from "./list-row.types";
import { preventRowAccessoryDrag } from "./list-row-accessory-events";
import { RowActions } from "./list-row-actions";

export const createResourceRowActions = (item: ListRowItem, showContextMenuTrigger = false) => {
  const contextMenuItems = item.contextMenuItems ?? [];
  if (contextMenuItems.length === 0 || !showContextMenuTrigger) return item.actions ?? [];

  const inlineMenuItems =
    item.actions?.flatMap((action) =>
      action.menuItems?.length
        ? action.menuItems
        : [
            {
              id: action.id,
              label: action.label,
              icon: action.icon,
              onAction: () => action.onAction?.({ nodeId: item.id }),
            },
          ],
    ) ?? [];
  const inlineIds = new Set(inlineMenuItems.map((menuItem) => menuItem.id));
  const resourceMenuItems = contextMenuItems
    .filter((menuItem) => !inlineIds.has(menuItem.id))
    .map((menuItem, index) => ({
      ...menuItem,
      separatorBefore: menuItem.separatorBefore || (index === 0 && inlineMenuItems.length > 0),
    }));

  return [
    {
      id: "resource-actions",
      label: "Resource actions",
      icon: <Icon as={ChevronDown} boxSize="14px" />,
      menuItems: [...inlineMenuItems, ...resourceMenuItems],
    },
  ];
};

const iconLabelGaps: Record<string, string> = { collection: "compact", tree: "1" };
const denseVariants = new Set(["compact", "collection", "full-width", "tree", "empty-state"]);

const resolveLabelColor = (input: {
  isEmptyStateVariant: boolean;
  isDisabled: boolean;
  tone: ListRowProps["tone"];
}) => {
  if (input.isEmptyStateVariant) return "fg.menu-item.secondary";
  if (input.isDisabled) return "fg.muted";
  if (input.tone === "danger") return "red.500";
  return "fg";
};

const RowLabel = (props: { label: ListRowItem["label"]; textStyle: string; color: string; labelId: string }) => {
  const { label, textStyle, color, labelId } = props;

  if (typeof label === "string") {
    return (
      <Text id={labelId} textStyle={textStyle} color={color} truncate>
        {label}
      </Text>
    );
  }

  return (
    <Box id={labelId} minW="0" maxW="full" overflow="hidden" color={color}>
      {label}
    </Box>
  );
};

const RowDescription = (props: {
  id: string;
  description: ListRowItem["description"];
  textStyle: string;
  color: string;
  marginLeft: string;
}) => {
  const { id, description, textStyle, color, marginLeft } = props;
  if (!description) return null;

  if (typeof description === "string") {
    return (
      <Text id={id} ml={marginLeft} textStyle={textStyle} color={color} truncate>
        {description}
      </Text>
    );
  }

  return (
    <Box id={id} ml={marginLeft} minW="0" maxW="full" overflow="hidden">
      {description}
    </Box>
  );
};

const RowChevron = (
  props: Pick<RowContentProps, "isExpanded" | "isDisabled" | "showChevron"> & { onToggleExpand?: () => void },
) => {
  const { isExpanded, isDisabled, showChevron, onToggleExpand } = props;
  const chevron = useRecipe({ key: "treeChevron" });
  return (
    <>
      {showChevron && onToggleExpand ? (
        <IconButton
          aria-label={isExpanded ? "Collapse group" : "Expand group"}
          aria-expanded={isExpanded}
          variant="ghost"
          size="2xs"
          disabled={isDisabled}
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand();
          }}
          onMouseDown={preventRowAccessoryDrag}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Icon as={ChevronRight} boxSize="12px" css={chevron()} data-open={isExpanded} />
        </IconButton>
      ) : null}
      {showChevron && !onToggleExpand ? (
        <Box color="fg.muted" flexShrink={0} display="flex" alignItems="center">
          <Icon as={ChevronRight} boxSize="12px" css={chevron()} data-open={isExpanded} />
        </Box>
      ) : null}
    </>
  );
};

const RowContent = (props: RowContentProps & { labelId: string; onToggleExpand?: () => void }) => {
  const { item, isExpanded, showChevron, isDisabled, variant, tone, labelId, onToggleExpand } = props;
  const isEmptyStateVariant = variant === "empty-state";
  const isDenseVariant = denseVariants.has(variant ?? "");
  const labelTextStyle = isDenseVariant ? "label/S/regular" : "label/M/regular";
  const descriptionTextStyle = isDenseVariant ? "label/XS" : "label/S/regular";
  const descriptionMarginLeft = isDenseVariant ? "0" : "2px";
  const iconPx = variant === "tree" || variant === "collection" ? "16px" : "14px";
  const iconLabelGap = iconLabelGaps[variant ?? ""] ?? "2";

  const labelColor = resolveLabelColor({
    isEmptyStateVariant,
    isDisabled,
    tone,
  });
  const iconColor = item.iconColor ?? (tone === "danger" ? "red.500" : "fg.muted");
  const descriptionColor = tone === "danger" ? "red.400" : "fg.menu-item.secondary";

  return (
    <HStack gap="2" minW="0" flex="1" overflow="hidden" alignItems="center">
      <RowChevron {...{ showChevron, isExpanded, isDisabled, onToggleExpand }} />
      {item.startContent ? (
        <Box flexShrink={0} display="flex" alignItems="center">
          {item.startContent}
        </Box>
      ) : null}
      <Stack gap="0" minW="0" flex="1">
        <HStack gap={iconLabelGap} minW="0" alignItems="center">
          {item.icon ? (
            <Box
              color={iconColor}
              flexShrink={0}
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              boxSize={iconPx}
              fontSize={iconPx}
              lineHeight="1"
              css={{ "& > svg": { width: iconPx, height: iconPx } }}
            >
              {item.icon}
            </Box>
          ) : null}
          {item.indicator ? (
            <Tooltip content={item.indicator.tooltip} disabled={!item.indicator.tooltip}>
              <Box color={item.indicator.color ?? "fg.muted"} flexShrink={0}>
                {item.indicator.icon}
              </Box>
            </Tooltip>
          ) : null}
          <RowLabel labelId={labelId} label={item.label} textStyle={labelTextStyle} color={labelColor} />
        </HStack>
        <RowDescription
          id={`${labelId}-description`}
          description={item.description}
          textStyle={descriptionTextStyle}
          color={descriptionColor}
          marginLeft={descriptionMarginLeft}
        />
      </Stack>
    </HStack>
  );
};

export const ListRowContent = (props: {
  labelId: string;
  item: ListRowItem;
  isExpanded: boolean;
  showChevron: boolean;
  isDisabled: boolean;
  tone: ListRowProps["tone"];
  variant: ListRowProps["variant"];
  showContextMenuTrigger: boolean;
  onToggleExpand?: () => void;
}) => {
  const {
    labelId,
    item,
    isDisabled,
    isExpanded,
    showChevron,
    tone = "default",
    variant = "default",
    showContextMenuTrigger,
    onToggleExpand,
  } = props;
  const actions = createResourceRowActions(item, showContextMenuTrigger);

  return (
    <>
      <RowContent
        labelId={labelId}
        item={item}
        isExpanded={isExpanded}
        showChevron={showChevron}
        isDisabled={isDisabled}
        tone={tone}
        variant={variant}
        onToggleExpand={onToggleExpand}
      />
      {item.endContent ? (
        <Box id={`${labelId}-end`} color="fg.muted" flexShrink={0} display="flex" alignItems="center">
          {item.endContent}
        </Box>
      ) : null}
      {actions.length > 0 ? (
        <RowActions
          actions={actions}
          context={{ nodeId: item.id }}
          alwaysVisible={
            item.actionsVisibility === "always" || (showContextMenuTrigger && (item.contextMenuItems?.length ?? 0) > 0)
          }
        />
      ) : null}
    </>
  );
};
