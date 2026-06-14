import { Badge, Icon, Menu } from "@chakra-ui/react";
import { Check, ChevronDown } from "lucide-react";

import { getIconComponent } from "@/components/icon-color-picker";
import { ListRow } from "@/components/list-row/list-row";
import type { AttributeBadge } from "./data-renderer-helpers";
import { getAttributeBadgeColorPalette } from "./data-renderer-helpers";

interface DataRendererAttributeBadgeProps {
  badge: AttributeBadge;
  onChange?: (attributeId: string, value: unknown) => void;
}

const stopRowActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();

const getSelectedValues = (badge: AttributeBadge) => {
  if (Array.isArray(badge.value)) return badge.value;
  return badge.value ? [badge.value] : [];
};

const toggleMultiValue = (values: string[], optionValue: string) =>
  values.includes(optionValue) ? values.filter((value) => value !== optionValue) : [...values, optionValue];

export const DataRendererAttributeBadge = (props: DataRendererAttributeBadgeProps) => {
  const { badge, onChange } = props;
  const options = badge.options ?? [];
  const canEdit = Boolean(onChange && badge.isEditable && options.length > 0);
  const isMultiValue = Array.isArray(badge.value);
  const selectedValues = getSelectedValues(badge);

  const handleOptionChange = (optionValue: string) => {
    const nextValue = isMultiValue ? toggleMultiValue(selectedValues, optionValue) : optionValue;
    onChange?.(badge.attributeId, nextValue);
  };

  const badgeContent = (
    <>
      {badge.icon ? (
        <Icon as={getIconComponent(badge.icon)} boxSize="3.5" color={`${badge.color ?? "gray"}.fg`} />
      ) : null}
      {badge.label}
      {canEdit ? <Icon as={ChevronDown} boxSize="3" color="fg.muted" /> : null}
    </>
  );

  if (!canEdit) {
    return (
      <Badge variant="subtle" colorPalette={getAttributeBadgeColorPalette(badge)} gap="2xs" textStyle="label/XS/medium">
        {badgeContent}
      </Badge>
    );
  }

  return (
    <Menu.Root closeOnSelect={!isMultiValue}>
      <Menu.Trigger asChild>
        <Badge
          as="span"
          role="button"
          tabIndex={0}
          variant="subtle"
          colorPalette={getAttributeBadgeColorPalette(badge)}
          gap="2xs"
          textStyle="label/XS/medium"
          cursor="pointer"
          _hover={{ bg: "bg.subtle" }}
          onClick={stopRowActivation}
          onPointerDown={stopRowActivation}
          onKeyDown={stopRowActivation}
        >
          {badgeContent}
        </Badge>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="180px" bg="bg">
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <Menu.Item key={option.value} value={option.value} role="option" asChild>
                <ListRow
                  asChild
                  variant="compact"
                  id={option.value}
                  label={option.label}
                  icon={<Icon as={getIconComponent(option.icon)} boxSize="16px" />}
                  iconColor={`${option.color ?? "gray"}.500`}
                  isSelected={isSelected}
                  endContent={isSelected ? <Check size={14} /> : undefined}
                  onActivate={() => handleOptionChange(option.value)}
                />
              </Menu.Item>
            );
          })}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
