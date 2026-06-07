export const parseSkillVersion = (content: string) => {
  const match = content.match(/- version:\s*(.+)/);
  return match?.[1]?.trim() ?? "";
};
