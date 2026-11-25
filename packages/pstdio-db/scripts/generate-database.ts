import { join } from "node:path";

const folder = join(import.meta.dirname, "../drizzle");
const journalPath = join(folder, "meta/_journal.json");
type Entry = { idx: number; tag: string };
const before = (await Bun.file(journalPath).json()).entries as Entry[];
const child = Bun.spawn(["bunx", "drizzle-kit", "generate", "--config", "./drizzle.config.ts"], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
const code = await child.exited;
if (code) process.exit(code);
const after = (await Bun.file(journalPath).json()).entries as Entry[];
for (const entry of after.filter((entry) => !before.some((old) => old.idx === entry.idx))) {
  const previous = after.find((candidate) => candidate.idx === entry.idx - 1);
  if (!previous) continue;
  const snapshot = await Bun.file(
    join(folder, "meta", `${String(previous.idx).padStart(4, "0")}_snapshot.json`),
  ).json();
  const file = Bun.file(join(folder, `${entry.tag}.sql`));
  const statements = (await file.text()).split("--> statement-breakpoint");
  const dropped = new Set(
    statements.flatMap((statement) => {
      const match = /^DROP TABLE "([^"]+)" CASCADE;$/u.exec(statement.trim());
      return match ? [match[1]] : [];
    }),
  );
  // Drizzle 0.31 can emit DROP TABLE ... CASCADE before dropping the same
  // referencing FK explicitly. Generate those FK drops before their parent
  // drops, using the prior snapshot rather than hand-editing migration SQL.
  const move = new Set(
    statements.flatMap((statement, index) => {
      const match = /^ALTER TABLE "([^"]+)" DROP CONSTRAINT "([^"]+)";$/u.exec(statement.trim());
      const target = match && snapshot.tables[`public.${match[1]}`]?.foreignKeys[match[2]]?.tableTo;
      return target && dropped.has(target) ? [index] : [];
    }),
  );
  if (!move.size) continue;
  const firstDrop = statements.findIndex((statement) => statement.trim().startsWith("DROP TABLE "));
  const ordered = statements.flatMap((statement, index) => [
    ...(index === firstDrop ? [...move].map((position) => statements[position]) : []),
    ...(move.has(index) ? [] : [statement]),
  ]);
  await Bun.write(file, ordered.join("--> statement-breakpoint"));
  console.log("Generated foreign-key drops before their dropped parent tables.");
}
