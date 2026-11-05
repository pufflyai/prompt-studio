import type { SessionImportPreview, SessionImportSource } from "pstdio-api-contracts";
import type { SessionImportDeps } from "./import-session";
import { importRowError, parseImportRow, type SessionImportRow } from "./inspect-row";
import { importedSessionId, jsonLines, openSessionImportSource } from "./source";

export const previewSessionImport = async (
  deps: SessionImportDeps,
  input: SessionImportSource,
  signal?: AbortSignal,
) => {
  const source = await openSessionImportSource(input, { signal });
  try {
    const result: SessionImportPreview = {
      sourcePath: source.sourcePath,
      fingerprint: source.fingerprint,
      total: 0,
      ready: 0,
      duplicates: 0,
      failed: 0,
      excluded: 0,
      projects: [],
      errors: [],
    };
    const projects = new Map<string, SessionImportPreview["projects"][number]>();
    const inspect = async (row: SessionImportRow) => {
      try {
        const session = parseImportRow(row);
        const targetProjectId = input.projectMap?.[session.project_id];
        const project = projects.get(session.project_id) ?? {
          sourceProjectId: session.project_id,
          name: source.names.get(session.project_id) ?? session.project_id,
          sessions: 0,
          targetProjectId,
        };
        project.sessions++;
        projects.set(session.project_id, project);
        if (targetProjectId && (await deps.sessionService.get(importedSessionId(session.id, targetProjectId))))
          result.duplicates++;
        else if (Object.keys(input.projectMap ?? {}).length && !targetProjectId) result.excluded++;
        else {
          await source.history(session);
          result.ready++;
        }
      } catch (error) {
        result.failed++;
        if (result.errors.length < 100) result.errors.push(importRowError(row, error));
      }
    };
    for await (const row of jsonLines(source.sessionsPath)) {
      signal?.throwIfAborted();
      result.total++;
      await inspect(row);
    }
    result.projects = [...projects.values()];
    return result;
  } finally {
    await source.close();
  }
};
