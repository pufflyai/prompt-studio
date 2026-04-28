const EXTENSION_COMMAND_FAILURE_PATTERN = /^Extension command "[^"]+" from "[^"]+" failed: /;

export const formatCliErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(EXTENSION_COMMAND_FAILURE_PATTERN, "");
};
