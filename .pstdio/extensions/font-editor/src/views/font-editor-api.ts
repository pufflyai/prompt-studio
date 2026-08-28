import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import type { fontEditorCommands } from "../commands/font-commands";

export const createFontEditorCommands = (host: GuestHost) =>
  createWebviewClient<typeof fontEditorCommands>(host).commands;

export const loadFontEditor = async (host: GuestHost) => {
  const commands = createFontEditorCommands(host);
  const [inspection, preview, config] = await Promise.all([
    commands.inspect(),
    commands.preview(),
    commands["config.get"](),
  ]);
  return { inspection, preview, config };
};

export const showError = (host: GuestHost, error: unknown) =>
  host.call("notification.show", {
    level: "error",
    title: "Font editor",
    message: error instanceof Error ? error.message : "The font operation failed.",
  });
