// Claude parses slash commands in every supported stream input shape. See ADR 0054.
export const claudePrompt = (prompt: string, nativeCommand = false) =>
  !nativeCommand && /^\/[^\s/]+(?:\s|$)/.test(prompt) ? `<user-message>\n${prompt}\n</user-message>` : prompt;
export const visibleClaudePrompt = (prompt: string) =>
  prompt.replace(/^<user-message>\n(\/[^\s/]+(?:\s[\s\S]*)?)\n<\/user-message>/, "$1");
