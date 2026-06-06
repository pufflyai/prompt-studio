import type {
  ExtensionBenchCommandRequest,
  ExtensionBenchCommandResponse,
  ExtensionBenchLoadResponse,
} from "./api-contract";

const apiJson = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(path, init);
  const text = await response.text();
  let body: unknown = {};

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    const preview = text.trim().slice(0, 160) || "empty response";
    throw new Error(`Expected JSON from ${path}, got status ${response.status}: ${preview}`);
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body as T;
};

export const loadExtensionWorkbench = (sourcePath: string) =>
  apiJson<ExtensionBenchLoadResponse>(`/__extension-testbench/load?source=${encodeURIComponent(sourcePath)}`);

export const executeExtensionCommand = (request: ExtensionBenchCommandRequest) =>
  apiJson<ExtensionBenchCommandResponse>("/__extension-testbench/command", {
    body: JSON.stringify(request),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
