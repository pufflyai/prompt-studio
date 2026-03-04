export const replacePlaceholders = (content: string, values: Record<string, string>) => {
  let result = content;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
};
