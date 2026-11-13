/**
 * Keeps the selected model visible at the top of long model lists. The other
 * options keep the order the harness returned them in.
 */
export const moveSelectedModelFirst = <T>(options: T[], isSelected: (option: T) => boolean): T[] => {
  const selectedIndex = options.findIndex(isSelected);
  if (selectedIndex <= 0) return options;

  return [options[selectedIndex], ...options.slice(0, selectedIndex), ...options.slice(selectedIndex + 1)];
};
