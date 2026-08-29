export const rawValueFor = (rawArgs: string[], name: string) => {
  const prefix = `--${name}=`;
  const inline = rawArgs.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = rawArgs.indexOf(`--${name}`);
  return index === -1 ? undefined : rawArgs[index + 1];
};

export const commandPathTokens = (rawArgs: string[]) => {
  const skipValueFor = new Set(["--api-port", "--dashboard-port", "--project-id"]);
  const tokens: string[] = [];

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg || arg.startsWith("-")) {
      if (skipValueFor.has(arg)) {
        index += 1;
        continue;
      }
      if (tokens.length > 0) break;
      continue;
    }
    tokens.push(arg);
  }

  return tokens;
};

export const firstCommandToken = (rawArgs: string[]) => commandPathTokens(rawArgs)[0];

export const shouldDispatchExtensionCommand = ({
  rawArgs,
  staticTopLevelCommands,
  hasProjectConfig,
}: {
  rawArgs: string[];
  staticTopLevelCommands: ReadonlySet<string>;
  hasProjectConfig: () => boolean;
}) => {
  const token = firstCommandToken(rawArgs);
  if (!token) return false;
  if (staticTopLevelCommands.has(token)) return false;
  if (rawValueFor(rawArgs, "project-id")) return true;

  return hasProjectConfig();
};
