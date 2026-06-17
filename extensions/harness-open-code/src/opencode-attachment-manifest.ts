import type { FilePart, HarnessAttachment } from "@pstdio/sdk/extensions";

const START_TAG = "<session-attachments>";
const END_TAG = "</session-attachments>";

const encodeString = (value: string | null | undefined) => JSON.stringify(value ?? "");

export const promptWithAttachmentManifest = (prompt: string, attachments: HarnessAttachment[] = []) => {
  if (attachments.length === 0) return prompt;

  return [
    prompt,
    "",
    START_TAG,
    ...attachments.map((attachment) =>
      [
        `- file_id=${encodeString(attachment.fileId)}`,
        `name=${encodeString(attachment.fileName)}`,
        `path=${encodeString(attachment.localPath)}`,
        `mime=${encodeString(attachment.mimeType)}`,
        `size=${attachment.sizeBytes}`,
        `url=${encodeString(attachment.url)}`,
      ].join(" "),
    ),
    END_TAG,
  ].join("\n");
};

const parseValue = (value: string | undefined) => {
  if (!value) return "";
  if (!value.startsWith('"')) return value;

  try {
    return JSON.parse(value) as string;
  } catch {
    return "";
  }
};

const parseAttachmentLine = (line: string): FilePart | null => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("- ")) return null;

  const values = new Map<string, string>();
  const attributes = trimmed.slice(2).matchAll(/([a-z_]+)=("(?:\\.|[^"\\])*"|[^\s]+)/g);
  for (const match of attributes) {
    values.set(match[1]!, match[2]!);
  }

  const url = parseValue(values.get("url")) || parseValue(values.get("path"));
  if (!url) return null;

  const size = Number(values.get("size"));

  return {
    type: "file",
    fileId: parseValue(values.get("file_id")) || undefined,
    filename: parseValue(values.get("name")) || undefined,
    mediaType: parseValue(values.get("mime")) || undefined,
    size: Number.isFinite(size) ? size : undefined,
    url,
  };
};

export const parseAttachmentManifest = (text: string) => {
  const start = text.indexOf(`\n\n${START_TAG}\n`);
  if (start === -1) return null;

  const bodyStart = start + `\n\n${START_TAG}\n`.length;
  const end = text.indexOf(`\n${END_TAG}`, bodyStart);
  if (end === -1) return null;

  const prompt = text.slice(0, start);
  const fileParts = text
    .slice(bodyStart, end)
    .split("\n")
    .map(parseAttachmentLine)
    .filter((part): part is FilePart => part !== null);

  return { prompt, fileParts };
};
