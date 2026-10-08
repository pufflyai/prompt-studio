import { isAbsolute, resolve } from "node:path";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import type { CodexThreadItem } from "./types";

export const snapshotCodexImage = async (item: CodexThreadItem, cwd?: string) => {
  if (item.type !== "image_view" || item.status !== "completed" || !item.path) return item;
  const path = isAbsolute(item.path) ? item.path : resolve(cwd ?? process.cwd(), item.path);
  try {
    const file = Bun.file(path);
    const src = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    return { ...item, output: [{ type: "image", source: item.path, src, mimeType: file.type }] };
  } catch {
    // The native view remains in history if its temporary file has already been removed.
    return item;
  }
};

export const snapshotCodexMessageImages = (messages: SessionMessage[], cwd?: string) =>
  Promise.all(
    messages.map(async (message) => ({
      ...message,
      parts: await Promise.all(
        message.parts.map(async (part) => {
          if (part.type !== "tool" || part.tool !== "view_image") return part;
          const path = (part.state?.input as { path?: string })?.path;
          const item = await snapshotCodexImage(
            { id: part.callId ?? "", type: "image_view", path, status: part.status },
            cwd,
          );
          return { ...part, state: { ...part.state, output: item.output ?? part.state?.output } };
        }),
      ),
    })),
  );
