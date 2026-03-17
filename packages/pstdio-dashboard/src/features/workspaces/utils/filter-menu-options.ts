interface MenuOption {
  label: string;
  value: string;
}

export const filterMenuOptions = <T extends MenuOption>(options: T[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return options;
  }

  return options.filter((option) => {
    const label = option.label.toLowerCase();
    const value = option.value.toLowerCase();
    return label.includes(normalizedQuery) || value.includes(normalizedQuery);
  });
};
