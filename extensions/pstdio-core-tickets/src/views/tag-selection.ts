export interface SelectableTag {
  type: "single_select" | "multi_select";
  options: { id: string }[];
}

export const nextTagSelection = (input: { current: string[]; optionId: string; tag: SelectableTag }) => {
  const { current, optionId, tag } = input;
  const optionIds = new Set(tag.options.map((option) => option.id));
  const others = current.filter((id) => !optionIds.has(id));
  const selectedForTag = current.filter((id) => optionIds.has(id));
  const isSelected = selectedForTag.includes(optionId);

  if (tag.type === "single_select") {
    return isSelected ? others : [...others, optionId];
  }

  if (isSelected) {
    return [...others, ...selectedForTag.filter((id) => id !== optionId)];
  }

  return [...others, ...selectedForTag, optionId];
};
