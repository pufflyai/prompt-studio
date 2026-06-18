import { Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import { Tooltip } from "../tooltip";
import type { ListRowItem, ListRowProps, RowContentProps } from "./list-row.types";
import { RowActions } from "./list-row-actions";

const RowContent = (props: RowContentProps) => {
  const { item, isExpanded, showChevron, isDisabled, variant, tone } = props;
  const isDenseVariant = variant === "compact" || variant === "tree";
  const labelTextStyle = isDenseVariant ? "label/S/regular" : "label/M/regular";
  const descriptionTextStyle = isDenseVariant ? "label/XS" : "label/S/regular";
  const descriptionMarginLeft = isDenseVariant ? "0" : "2px";
  const iconPx = variant === "tree" ? "16px" : "14px";

  const labelColor = (() => {
    if (isDisabled) return "fg.muted";
    if (tone === "danger") return "red.500";
    return "fg";
  })();
  const iconColor = item.iconColor ?? (tone === "danger" ? "red.500" : "fg.muted");
  const descriptionColor = tone === "danger" ? "red.400" : "fg.menu-item.secondary";

  return (
    <HStack gap="2" minW="0" flex="1" overflow="hidden" alignItems="center">
      {showChevron ? (
        <Box color="fg.muted" flexShrink={0} display="flex" alignItems="center">
          <Icon
            as={ChevronRight}
            boxSize="12px"
            transform={isExpanded ? "rotate(90deg)" : "rotate(0deg)"}
            transition="transform 120ms ease"
          />
        </Box>
      ) : null}
      <Stack gap="2xs" minW="0" flex="1">
        <HStack gap="2" minW="0" alignItems="center">
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
            <Tooltip content={item.indicator.tooltip} disabled={!item.indicator.tooltip} openDelay={300}>
              <Box color={item.indicator.color ?? "fg.muted"} flexShrink={0}>
                {item.indicator.icon}
              </Box>
            </Tooltip>
          ) : null}
          {typeof item.label === "string" ? (
            <Text textStyle={labelTextStyle} color={labelColor} truncate>
              {item.label}
            </Text>
          ) : (
            <Box minW="0" maxW="full" overflow="hidden" color={labelColor}>
              {item.label}
            </Box>
          )}
        </HStack>
        {item.description ? (
          typeof item.description === "string" ? (
            <Text ml={descriptionMarginLeft} textStyle={descriptionTextStyle} color={descriptionColor} truncate>
              {item.description}
            </Text>
          ) : (
            <Box ml={descriptionMarginLeft} minW="0" maxW="full" overflow="hidden">
              {item.description}
            </Box>
          )
        ) : null}
      </Stack>
    </HStack>
  );
};

export const ListRowContent = (props: {
  item: ListRowItem;
  isExpanded: boolean;
  showChevron: boolean;
  isDisabled: boolean;
  tone: ListRowProps["tone"];
  variant: ListRowProps["variant"];
}) => {
  const { item, isDisabled, isExpanded, showChevron, tone = "default", variant = "default" } = props;

  return (
    <>
      <RowContent
        item={item}
        isExpanded={isExpanded}
        showChevron={showChevron}
        isDisabled={isDisabled}
        tone={tone}
        variant={variant}
      />
      {item.endContent ? (
        <Box flexShrink={0} color="fg.muted" display="flex" alignItems="center">
          {item.endContent}
        </Box>
      ) : null}
      {item.actions && item.actions.length > 0 ? (
        <RowActions actions={item.actions} context={{ nodeId: item.id }} />
      ) : null}
    </>
  );
};
