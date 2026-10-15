import type { ResourceRef } from "@pstdio/workbench";

export const sessionMenuPage = <T extends { id: string; title: string; resource: ResourceRef }>(
  sessions: readonly T[],
  request: { query: string; cursor?: string },
) => {
  const query = request.query.trim().toLocaleLowerCase();
  const matches = sessions.filter((session) => !query || session.title.toLocaleLowerCase().includes(query));
  const start = request.cursor ? matches.findIndex((session) => session.id === request.cursor) + 1 : 0;
  const rows = matches.slice(start, start + 20);
  return { rows, nextCursor: start + rows.length < matches.length ? rows.at(-1)?.id : undefined };
};
