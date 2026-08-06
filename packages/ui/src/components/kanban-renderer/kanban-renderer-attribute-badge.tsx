import { Badge, Icon, Menu, Portal } from "@chakra-ui/react";
import { Check, ChevronDown, Square, SquareCheck } from "lucide-react";
import { ListRow } from "@/components/list-row/list-row";
import { getIconComponent } from "@/components/primitives/icon-options";
import type { AttributeBadge } from "./kanban-renderer-helpers";

interface KanbanRendererAttributeBadgeProps {
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

const badgeStyleProps = {
  bg: { _light: "bg.muted", _dark: "bg.subtle" },
  color: "fg.muted",
  _hover: { bg: { _light: "bg.subtle", _dark: "bg.hover" } },
} as const;

const getBadgeIconColor = (badge: AttributeBadge) => (badge.color ? `${badge.color}.fg` : "fg.muted");

const selectionIcon = (input: { isMultiValue: boolean; isSelected: boolean }) => {
  if (input.isMultiValue) return input.isSelected ? <SquareCheck size={14} /> : <Square size={14} />;
  return input.isSelected ? <Check size={14} /> : null;
};

export const KanbanRendererAttributeBadge = (props: KanbanRendererAttributeBadgeProps) => {
  const { badge, onChange } = props;
  const options = badge.options ?? [];
  const canEdit = Boolean(onChange && badge.isEditable && options.length > 0);
  const isMultiValue = Array.isArray(badge.value);
  const selectedValues = getSelectedValues(badge);
  const rowInteractionProps = {
    onClick: stopRowActivation,
    onPointerDown: stopRowActivation,
    onKeyDown: stopRowActivation,
  };

  const handleOptionChange = (optionValue: string) => {
    let nextValue: string | string[];
    if (isMultiValue) nextValue = toggleMultiValue(selectedValues, optionValue);
    else nextValue = selectedValues.includes(optionValue) ? "" : optionValue;
    onChange?.(badge.attributeId, nextValue);
  };

  const badgeContent = (
    <>
      {badge.icon ? <Icon as={getIconComponent(badge.icon)} boxSize="3.5" color={getBadgeIconColor(badge)} /> : null}
      {badge.label}
      {canEdit ? <Icon as={ChevronDown} boxSize="3" color="fg.muted" /> : null}
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
    <Menu.Root closeOnSelect={!isMultiValue}>
      <Menu.Trigger asChild>
        <Badge
          as="span"
          role="button"
          tabIndex={0}
          variant="subtle"
          gap="2xs"
          textStyle="label/XS/medium"
          cursor="pointer"
          {...badgeStyleProps}
          onClick={stopRowActivation}
          onPointerDown={stopRowActivation}
          onKeyDown={stopRowActivation}
        >
          {badgeContent}
        </Badge>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            minW="180px"
            p="0"
            gap="0"
            onClick={stopRowActivation}
            onPointerDown={stopRowActivation}
            onKeyDown={stopRowActivation}
          >
            {options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <Menu.Item key={option.value} value={option.value} asChild>
                  <ListRow
                    asChild
                    role={isMultiValue ? "menuitemcheckbox" : "menuitemradio"}
                    aria-checked={isSelected}
                    variant="full-width"
                    id={option.value}
                    label={option.label}
                    icon={<Icon as={getIconComponent(option.icon)} boxSize="16px" />}
                    iconColor={`${option.color ?? "gray"}.500`}
                    isSelected={isSelected}
                    endContent={selectionIcon({ isMultiValue, isSelected })}
                    onActivate={() => handleOptionChange(option.value)}
                    {...rowInteractionProps}
                  />
                </Menu.Item>
              );
            })}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
