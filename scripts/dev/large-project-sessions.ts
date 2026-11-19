// Writes a database-export folder that `POST /v1/session-imports` reads: sessions and files tables
// plus one JSON transcript per session. Source project IDs are placeholders mapped at import time.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOPICS = ["Fix", "Refactor", "Investigate", "Document", "Speed up", "Review"];
const AREAS = ["ticket board", "sync engine", "file tree", "session list", "workspace setup", "relay"];

export interface ExportedProject {
  sourceId: string;
  name: string;
  sessions: number;
  longTranscripts?: boolean;
}

/** The ID an imported session gets in its target project (mirrors importedSessionId in the API). */
export const importedSessionId = (sourceId: string, targetProjectId: string) =>
  `imported-${createHash("sha256")
    .update(JSON.stringify([targetProjectId, sourceId]))
    .digest("hex")}`;

const transcript = (index: number, title: string, startedAt: number) => [
  {
    id: `m-${index}-1`,
    role: "user",
    createdAt: startedAt,
    parts: [{ type: "text", text: `${title}. Keep the change small.` }],
  },
  {
    id: `m-${index}-2`,
    role: "assistant",
    createdAt: startedAt + 20_000,
    parts: [
      { type: "reasoning", text: "Read the relevant module and its tests before changing anything." },
      { type: "text", text: `I traced the ${AREAS[index % AREAS.length]} code path and found the cause.` },
    ],
  },
  { id: `m-${index}-3`, role: "user", createdAt: startedAt + 90_000, parts: [{ type: "text", text: "Go ahead." }] },
  {
    id: `m-${index}-4`,
    role: "assistant",
    createdAt: startedAt + 240_000,
    parts: [
      { type: "text", text: `Done. ${"The change is covered by a focused test and the suite passes. ".repeat(3)}` },
    ],
  },
];

/** Writes the export under `folder` and returns each project's source session IDs in order. */
export const writeSessionExport = (folder: string, projects: ExportedProject[]) => {
  const tables = join(folder, "tables");
  mkdirSync(tables, { recursive: true });
  const sessions: string[] = [];
  const files: string[] = [];
  const ids = new Map<string, string[]>();
  const now = Date.now();
  for (const project of projects) {
    const projectIds: string[] = [];
    for (let index = 0; index < project.sessions; index++) {
      const id = `${project.sourceId}-session-${index + 1}`;
      const fileId = `${id}-messages`;
      const title = `${TOPICS[index % TOPICS.length]} the ${AREAS[index % AREAS.length]} (${index + 1})`;
      const startedAt = now - (index % 240) * (DAY_MS / 2) - (index % 17) * 60_000;
      const storagePath = join("files", project.sourceId, fileId);
      mkdirSync(join(folder, "files", project.sourceId), { recursive: true });
      const messages = transcript(index, title, startedAt);
      if (project.longTranscripts && index % 10 === 0) {
        for (let turn = 0; turn < 20; turn++) {
          messages.push({
            id: `m-${index}-history-${turn}`,
            role: turn % 2 === 0 ? "user" : "assistant",
            createdAt: startedAt + 250_000 + turn * 1000,
            parts: [
              { type: "text", text: `Follow-up ${turn}. ${"Résumé · 修正 · notes from the review. ".repeat(80)}` },
            ],
          });
        }
      }
      writeFileSync(join(folder, storagePath), JSON.stringify(messages));
      const at = (ms: number) => new Date(ms).toISOString();
      sessions.push(
        JSON.stringify({
          id,
          project_id: project.sourceId,
          title,
          agent: "pstdio.harness-codex.harness.codex",
          status: index % 9 === 0 ? "failed" : "completed",
          archived: index % 4 === 0,
          session_file_id: fileId,
          last_request_started: at(startedAt),
          last_request_ended: at(startedAt + 240_000),
          created_at: at(startedAt),
          updated_at: at(startedAt + 240_000),
        }),
      );
      files.push(
        JSON.stringify({
          id: fileId,
          project_id: project.sourceId,
          storage_path: storagePath,
          file_name: "messages.json",
          mime_type: "application/json",
        }),
      );
      projectIds.push(id);
    }
    ids.set(project.sourceId, projectIds);
  }
  writeFileSync(join(tables, "public.sessions.jsonl"), `${sessions.join("\n")}\n`);
  writeFileSync(join(tables, "public.files.jsonl"), `${files.join("\n")}\n`);
  writeFileSync(
    join(tables, "public.projects.jsonl"),
    `${projects.map((project) => JSON.stringify({ id: project.sourceId, name: project.name })).join("\n")}\n`,
  );
  return ids;
};
