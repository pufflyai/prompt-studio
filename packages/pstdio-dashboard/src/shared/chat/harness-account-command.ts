/** Account commands are handled locally and never submitted as an agent prompt. */
export const harnessAccountCommand = (text: string) => {
  const match = /^\/(login|logout)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match) return null;
  return { action: match[1] as "login" | "logout", argument: match[2]?.trim() ?? "" };
};

/** Routing is independent of account discovery, including unsupported harnesses. */
export const createHarnessAccountCommandHandler = (handlers: {
  start(action: "login" | "logout"): Error | undefined;
  rejectArguments(action: "login" | "logout"): Error;
}) => ({
  isCommand: (text: string) => Boolean(harnessAccountCommand(text)),
  submit: (text: string, onSubmitted?: () => void) => {
    const command = harnessAccountCommand(text);
    if (!command) return undefined;
    if (command.argument) return Promise.reject(handlers.rejectArguments(command.action));
    const failure = handlers.start(command.action);
    if (failure) return Promise.reject(failure);
    onSubmitted?.();
    return Promise.resolve();
  },
});
