const LOCAL_COMMANDS = new Set(["close", "serve"]);
const LOCAL_EXTENSION_COMMANDS = new Set(["add", "check"]);

export const shouldEnsureApiForCommand = (argv: { _: unknown[] }) => {
  const [topLevel, subcommand] = argv._;
  if (typeof topLevel !== "string") return true;
  if (LOCAL_COMMANDS.has(topLevel)) return false;
  if (topLevel === "extensions" && typeof subcommand === "string") {
    return !LOCAL_EXTENSION_COMMANDS.has(subcommand);
  }
  return true;
};
