import { Icon, Text, Wrap } from "@chakra-ui/react";
import { Chip } from "../../primitives/chip";
import { getIconComponent } from "../../primitives/icon-color-picker";
import { ResourceBadge } from "../../primitives/resource-badge";
import type { ResourceOption, ResourceRefValue } from "../param-editor.types";

const optionIcon = (option: ResourceOption) => (
  <Icon as={getIconComponent(option.icon)} boxSize="14px" color={option.color ? `${option.color}.500` : "fg.muted"} />
);

const openExternal = (href: string) => window.open(href, "_blank", "noreferrer");

const copyToClipboard = (text: string) => void navigator.clipboard?.writeText(text).catch(() => undefined);

interface ResourceChipProps {
  option: ResourceOption;
  onOpenResource?: (ref: ResourceRefValue) => void;
  onRemove?: () => void;
}

// A chip opens its external href in a new tab, opens its internal ref via the host, or
// copies its text to the clipboard — whichever the option declares.
export const ResourceChip = (props: ResourceChipProps) => {
  const { option, onOpenResource, onRemove } = props;
  const isReference = Boolean(option.href || option.ref || option.copyText);

  if (!isReference) {
    return <Chip>{option.name}</Chip>;
  }

  const handleSelect =
    option.href && option.href.length > 0
      ? () => openExternal(option.href!)
      : option.ref && onOpenResource
        ? () => onOpenResource(option.ref!)
        : option.copyText
          ? () => copyToClipboard(option.copyText!)
          : undefined;

  return (
    <ResourceBadge
      fileName={option.name}
      icon={optionIcon(option)}
      size="md"
      onSelect={handleSelect ? () => handleSelect() : undefined}
      onRemove={onRemove ? () => onRemove() : undefined}
    />
  );
};

interface ResourceChipListProps {
  options: ResourceOption[];
  onOpenResource?: (ref: ResourceRefValue) => void;
  onRemove?: (optionId: string) => void;
  emptyText?: string;
}

export const ResourceChipList = (props: ResourceChipListProps) => {
  const { options, onOpenResource, onRemove, emptyText } = props;

  if (options.length === 0) {
    return (
      <Text textStyle="label/S/regular" color="fg.muted">
        {emptyText ?? "None"}
      </Text>
    );
  }

  return (
    <Wrap gap="2xs">
      {options.map((option) => (
        <ResourceChip
          key={option.id}
          option={option}
          onOpenResource={onOpenResource}
          onRemove={onRemove ? () => onRemove(option.id) : undefined}
        />
      ))}
    </Wrap>
  );
};
