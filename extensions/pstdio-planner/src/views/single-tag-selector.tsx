import { TagBubbleSelector } from "@pstdio/ui";

export interface TagSelectorOption {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description?: string | null;
}

export interface TagSelectorTag {
  id: string;
  name: string;
  type: "single_select" | "multi_select";
  options: TagSelectorOption[];
}

interface SingleTagSelectorProps {
  tag: TagSelectorTag;
  selectedOptionIds: string[];
  onChange?: (nextIds: string[]) => void;
  isDisabled?: boolean;
  size?: "xs" | "sm";
}

// Ported from the old dashboard's ticket properties tag selector. `onChange`
// receives the full next tag-id selection (other tags preserved) so a single
// `set-ticket-tags` call replaces the ticket's tags.
export const SingleTagSelector = (props: SingleTagSelectorProps) => {
  const { tag, selectedOptionIds, onChange, isDisabled = false, size = "sm" } = props;

  const selectedSet = new Set(selectedOptionIds);
  const tagOptionIds = new Set(tag.options.map((option) => option.id));
  const selectedForTagIds = tag.options.filter((option) => selectedSet.has(option.id)).map((option) => option.id);

  const handleSelectedForTagChange = (nextIds: string[]) => {
    if (!onChange) return;
    const otherTagIds = selectedOptionIds.filter((id) => !tagOptionIds.has(id));
    onChange([...otherTagIds, ...nextIds]);
  };

  if (tag.options.length === 0) return null;

  return (
    <TagBubbleSelector
      label={tag.name}
      options={tag.options.map((option) => ({
        id: option.id,
        label: option.name,
        color: option.color,
        icon: option.icon,
        description: option.description,
      }))}
      selectedOptionIds={selectedForTagIds}
      selectionMode={tag.type === "single_select" ? "single" : "multiple"}
      disabled={isDisabled || !onChange}
      size={size}
      onSelectedOptionIdsChange={handleSelectedForTagChange}
    />
  );
};
