import type { GuestHost } from "@pstdio/sdk/extensions";
import type { FontConfigView, FontInspectionView, FontPreviewView } from "./types";

interface CommandResponse<TResult> {
  outcome: {
    status: "success" | "rejected" | "error";
    reason?: string;
    value?: TResult;
  };
}

export const executeFontCommand = async <TResult>(
  host: GuestHost,
  commandId: string,
  params?: Record<string, unknown>,
) => {
  const response = await host.call<CommandResponse<TResult>>("commands.execute", { commandId, params });
  if (response.outcome.status !== "success") {
    throw new Error(response.outcome.reason ?? `${commandId} failed.`);
  }
  return response.outcome.value as TResult;
};

export const loadFontEditor = async (host: GuestHost) => {
  const [inspection, preview, config] = await Promise.all([
    executeFontCommand<FontInspectionView>(host, "font-editor.inspect"),
    executeFontCommand<FontPreviewView>(host, "font-editor.preview"),
    executeFontCommand<FontConfigView>(host, "font-editor.config.get"),
  ]);
  return { inspection, preview, config };
};

export const showError = (host: GuestHost, error: unknown) =>
  host.call("notification.show", {
    level: "error",
    title: "Font editor",
    message: error instanceof Error ? error.message : "The font operation failed.",
  });
