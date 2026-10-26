/** Account commands are handled locally and never submitted as an agent prompt. */
export const harnessAccountCommand = (text: string) => {
  const match = /^\/(login|logout)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match) return null;
  return { action: match[1] as "login" | "logout", argument: match[2]?.trim() ?? "" };
};
