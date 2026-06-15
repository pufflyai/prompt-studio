export const parseSkillVersion = (content: string) => {
  const match = content.match(/^\s*-?\s*version:\s*(.+)\s*$/m);
  return match?.[1]?.trim() ?? "";
};
