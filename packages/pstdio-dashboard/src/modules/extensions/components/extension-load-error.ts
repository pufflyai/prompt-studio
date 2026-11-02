type LoadError = Record<string, unknown> | null | undefined;

export const loadErrorField = (error: LoadError, key: "code" | "message") => {
  const value = error?.[key];
  return typeof value === "string" ? value : undefined;
};

// The code goes first so a pasted report starts with the value people search for.
export const loadErrorClipboardText = (error: LoadError) =>
  [loadErrorField(error, "code"), loadErrorField(error, "message")].filter(Boolean).join("\n");
