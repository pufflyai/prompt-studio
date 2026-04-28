export const parseStdoutLine = (data: string) => {
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
};
