import { strToU8, unzipSync, zipSync } from "fflate";

const collectCredentials = (value: unknown, secrets: Set<string>) => {
  if (typeof value === "string") {
    for (const match of value.matchAll(/(?:pstdio_runtime_session=|Bearer )([^;\s"\\]+)/g)) {
      if (match[1]) secrets.add(match[1]);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (
    "name" in value &&
    value.name === "pstdio_runtime_session" &&
    "value" in value &&
    typeof value.value === "string"
  ) {
    secrets.add(value.value);
  }
  for (const child of Object.values(value)) collectCredentials(child, secrets);
};

export const redactTraceArchive = (archive: Uint8Array) => {
  const entries = unzipSync(archive);
  const texts = new Map<string, string>();
  const secrets = new Set<string>();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (const [name, contents] of Object.entries(entries)) {
    let text: string;
    try {
      text = decoder.decode(contents);
    } catch {
      continue;
    }
    texts.set(name, text);
    for (const line of text.split("\n")) {
      try {
        collectCredentials(JSON.parse(line), secrets);
      } catch {
        collectCredentials(line, secrets);
      }
    }
  }
  for (const [name, text] of texts) {
    let redacted = text;
    for (const secret of secrets) {
      if (secret) redacted = redacted.replaceAll(secret, "[REDACTED]");
    }
    entries[name] = strToU8(redacted);
  }
  return zipSync(entries);
};
