import { readFile } from "node:fs/promises";
import { normalizePiMessages, type PiMessage } from "./messages";

interface PiEntry {
  type: string;
  id: string;
  parentId?: string | null;
  message?: PiMessage;
  content?: PiMessage["content"];
  timestamp?: string;
  display?: boolean;
}

// Pi's RPC get_messages is model context, which drops old turns after compaction.
// Its append-only session tree retains the full conversation on the active branch.
export const readPiHistory = async (path: string) => {
  const content = await readFile(path, "utf8");
  const lines = content.split("\n");
  const entries = new Map<string, PiEntry>();
  let leaf: string | undefined;
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    let entry: PiEntry;
    try {
      entry = JSON.parse(line) as PiEntry;
    } catch (error) {
      // A live Pi process can be appending the final record while history is read.
      if (index === lines.length - 1) break;
      throw error;
    }
    if (entry.type === "session") continue;
    entries.set(entry.id, entry);
    leaf = entry.id;
  }
  const branch: PiMessage[] = [];
  while (leaf) {
    const entry = entries.get(leaf);
    if (!entry) throw new Error("Pi session history has a missing parent entry.");
    if (entry.type === "message" && entry.message) branch.push(entry.message);
    if (entry.type === "custom_message")
      branch.push({
        role: "custom",
        content: entry.content,
        timestamp: Date.parse(entry.timestamp ?? ""),
        display: entry.display,
      });
    leaf = entry.parentId ?? undefined;
  }
  return normalizePiMessages(branch.reverse());
};
