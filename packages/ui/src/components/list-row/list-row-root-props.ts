import type { chakra } from "@chakra-ui/react";
import type { ComponentPropsWithoutRef } from "react";
import type { ListRowProps } from "./list-row.types";

type ListRowRootProps = ComponentPropsWithoutRef<typeof chakra.div>;

export const computePaddingLeft = (depth: number) => {
  if (depth <= 0) return undefined;
  return `calc(var(--chakra-spacing-1) + ${depth} * 12px)`;
};

const isFixedHeightDenseVariant = (variant: ListRowProps["variant"]) =>
  variant === "compact" || variant === "full-width" || variant === "empty-state";

export const resolveListRowSizing = (variant: ListRowProps["variant"], hasDescription: boolean) => {
  if (variant === "collection" && !hasDescription) {
    return { rowHeight: "collection-row", minHeight: undefined };
  }

  if (isFixedHeightDenseVariant(variant) && !hasDescription) {
    return { rowHeight: "1.75rem", minHeight: undefined };
  }

  return {
    rowHeight: "auto",
    minHeight: variant === "default" ? "2.25rem" : "1.75rem",
  };
};

const createRowBackgroundProps = (input: {
  isSelected: boolean;
  selectedBg: ListRowProps["selectedBg"];
  hoverBg: ListRowProps["hoverBg"];
  tone: NonNullable<ListRowProps["tone"]>;
  variant: ListRowProps["variant"];
}) => ({
  bg: input.isSelected ? input.selectedBg : "transparent",
  _hover: (() => {
    if (input.variant === "empty-state") return { bg: "transparent" };
    if (input.isSelected) return { bg: input.selectedBg };
    if (input.tone === "danger")
      return {
        outline: "1px solid",
        outlineColor: "red.500",
        outlineOffset: "-1px",
      };
    return { bg: input.hoverBg };
  })(),
  _active: input.variant === "empty-state" ? { bg: "transparent" } : { bg: input.selectedBg },
});

const rowLabelIds = (labelId: string, hasEndContent: boolean) =>
  hasEndContent ? `${labelId} ${labelId}-end` : labelId;

export const createListRowRootProps = (input: {
  rootProps: ListRowRootProps;
  labelId: string;
  hasEndContent: boolean;
  rowRole: ListRowRootProps["role"];
  className?: string;
  isSelected: boolean;
  isExpanded: boolean;
  showChevron: boolean;
  rowHeight: ListRowRootProps["height"];
  minHeight: ListRowRootProps["minHeight"];
  verticalPadding: ListRowRootProps["py"];
  paddingLeft: ListRowRootProps["pl"];
  selectedBg: ListRowProps["selectedBg"];
  hoverBg: ListRowProps["hoverBg"];
  tone: NonNullable<ListRowProps["tone"]>;
  isDisabled: boolean;
  variant: ListRowProps["variant"];
}) => ({
  "aria-labelledby": input.rootProps["aria-label"] ? undefined : rowLabelIds(input.labelId, input.hasEndContent),
  ...input.rootProps,
  role: input.rowRole,
  "aria-selected": input.rootProps["aria-selected"] ?? (input.rowRole === "option" ? input.isSelected : undefined),
  "aria-expanded": input.showChevron ? input.isExpanded : undefined,
  className: input.className ? `group ${input.className}` : "group",
  width: "full",
  minWidth: "0",
  maxWidth: "full",
  height: input.rowHeight,
  minHeight: input.minHeight,
  display: "flex" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  gap: "xs" as const,
  px: "sm",
  py: input.verticalPadding,
  pl: input.paddingLeft,
  borderRadius: input.variant === "full-width" || input.variant === "collection" ? "0" : ("xs" as const),
  ...createRowBackgroundProps({ ...input }),
  cursor:
    input.variant === "empty-state"
      ? ("default" as const)
      : input.isDisabled
        ? ("not-allowed" as const)
        : ("pointer" as const),
  overflow: "hidden" as const,
  textAlign: "left" as const,
  color: "inherit",
  textDecoration: "none",
});
