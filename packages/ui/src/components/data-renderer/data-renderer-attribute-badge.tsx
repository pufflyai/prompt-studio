import { Badge, Icon } from "@chakra-ui/react";

import { getIconComponent } from "@/components/icon-color-picker";
import { TagBubbleSelector } from "@/components/tag-bubble-selector";
import { suppressNextDataRendererCardClick } from "./card-interaction-guard";
import type { AttributeBadge } from "./data-renderer-helpers";

interface DataRendererAttributeBadgeProps {
  badge: AttributeBadge;
  onChange?: (attributeId: string, value: unknown) => void;
}

const stopRowActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();
const markRowActivationSuppression = () => suppressNextDataRendererCardClick();
const suppressRowActivation = (event: { stopPropagation: () => void }) => {
  markRowActivationSuppression();
  event.stopPropagation();
};

const getSelectedValues = (badge: AttributeBadge) => {
  if (Array.isArray(badge.value)) return badge.value;
  return badge.value ? [badge.value] : [];
};

const badgeStyleProps = {
  bg: { _light: "bg.muted", _dark: "bg.subtle" },
  color: "fg.muted",
  _hover: { bg: { _light: "bg.subtle", _dark: "bg.hover" } },
} as const;

const getBadgeIconColor = (badge: AttributeBadge) => (badge.color ? `${badge.color}.fg` : "fg.muted");

export const DataRendererAttributeBadge = (props: DataRendererAttributeBadgeProps) => {
  const { badge, onChange } = props;
  const options = badge.options ?? [];
  const canEdit = Boolean(onChange && badge.isEditable && options.length > 0);
  const isMultiValue = Array.isArray(badge.value);
  const selectedValues = getSelectedValues(badge);
  const attributeLabel = badge.attributeLabel ?? badge.label;

  const handleSelectedOptionIdsChange = (nextIds: string[]) => {
    onChange?.(badge.attributeId, isMultiValue ? nextIds : (nextIds[0] ?? ""));
  };

  const badgeContent = (
    <>
      {badge.icon ? <Icon as={getIconComponent(badge.icon)} boxSize="3.5" color={getBadgeIconColor(badge)} /> : null}
      {badge.label}
    </>
  );

  if (!canEdit) {
    return (
      <Badge variant="subtle" gap="2xs" textStyle="label/XS/medium" {...badgeStyleProps}>
        {badgeContent}
      </Badge>
    );
  }

  return (
    <TagBubbleSelector
      label={attributeLabel}
      selectedLabel={selectedValues.length > 0 ? badge.label : undefined}
      options={options.map((option) => ({
        id: option.value,
        label: option.label,
        color: option.color,
        icon: option.icon,
      }))}
      selectedOptionIds={selectedValues}
      selectionMode={isMultiValue ? "multiple" : "single"}
      onSelectedOptionIdsChange={handleSelectedOptionIdsChange}
      interactionProps={{
        onClickCapture: markRowActivationSuppression,
        onClick: stopRowActivation,
        onPointerDownCapture: markRowActivationSuppression,
        onPointerDown: suppressRowActivation,
        onKeyDown: stopRowActivation,
      }}
    />
  );
};
