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
const generated = after.filter((entry) => !before.some((old) => old.idx === entry.idx));
for (const entry of generated) {
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
  const firstDrop = statements.findIndex((statement) => statement.trim().startsWith("DROP TABLE "));
  const ordered = statements.flatMap((statement, index) => [
    ...(index === firstDrop ? [...move].map((position) => statements[position]) : []),
    ...(move.has(index) ? [] : [statement]),
  ]);
  // Drizzle can also put a replacement primary key before its newly added columns.
  // Keep generated column additions before constraints that require those columns.
  let movedColumns = false;
  for (const statement of statements) {
    const added = /^ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)" /u.exec(statement.trim());
    if (!added) continue;
    const constraint = ordered.findIndex(
      (candidate) =>
        candidate.trim().startsWith(`ALTER TABLE "${added[1]}" ADD CONSTRAINT `) && candidate.includes(`"${added[2]}"`),
    );
    const column = ordered.indexOf(statement);
    if (constraint < 0 || column < constraint) continue;
    ordered.splice(column, 1);
    ordered.splice(constraint, 0, statement);
    movedColumns = true;
  }
  // Dropping a key column removes its primary key implicitly. A later explicit
  // key drop would then fail, so generate it before the first such column drop.
  let movedKeys = false;
  for (const statement of statements) {
    const drop = /^ALTER TABLE "([^"]+)" DROP CONSTRAINT "([^"]+)";$/u.exec(statement.trim());
    const columns: string[] | undefined =
      drop && snapshot.tables[`public.${drop[1]}`]?.compositePrimaryKeys[drop[2]]?.columns;
    if (!drop || !columns) continue;
    const dependency = ordered.findIndex((candidate) => {
      const column = /^ALTER TABLE "([^"]+)" DROP COLUMN "([^"]+)";$/u.exec(candidate.trim());
      return column?.[1] === drop[1] && columns.includes(column[2]!);
    });
    const constraint = ordered.indexOf(statement);
    if (dependency < 0 || constraint < dependency) continue;
    ordered.splice(constraint, 1);
    ordered.splice(dependency, 0, statement);
    movedKeys = true;
  }
  // PostgreSQL cannot implicitly assign text to timestamptz. Generate the
  // explicit cast from the old schema, including tables renamed in this entry.
  const renamedFrom = new Map<string, string>();
  for (const statement of ordered) {
    const rename = /^ALTER TABLE "([^"]+)" RENAME TO "([^"]+)";$/u.exec(statement.trim());
    if (rename) renamedFrom.set(rename[2]!, rename[1]!);
  }
  let castTimestamps = false;
  for (const [index, statement] of ordered.entries()) {
    const change = /^ALTER TABLE "([^"]+)" ALTER COLUMN "([^"]+)" SET DATA TYPE timestamp with time zone;$/u.exec(
      statement.trim(),
    );
    if (!change) continue;
    const table = renamedFrom.get(change[1]!) ?? change[1]!;
    if (snapshot.tables[`public.${table}`]?.columns[change[2]!]?.type !== "text") continue;
    ordered[index] = statement.replace(/;\s*$/u, ` USING "${change[2]}"::timestamp with time zone;`);
    castTimestamps = true;
  }
  // This baseline needs the new owner graph before converting released frames.
  // Keep its generated input-table drops for admission's post-data transaction.
  const retired = new Set(["storage_record_sync", "storage_record_outbox", "storage_ordered_owners"]);
  const deferred = ordered.filter((statement) => {
    const drop = /^DROP TABLE "([^"]+)" CASCADE;$/u.exec(statement.trim());
    return drop && retired.has(drop[1]!);
  });
  if (deferred.length && deferred.length !== retired.size)
    throw new Error("Legacy retirement must generate all three input-table drops together");
  if (deferred.length)
    await Bun.write(join(folder, `${entry.tag}.post-data.sql`), deferred.join("--> statement-breakpoint"));
  if (!move.size && !movedColumns && !movedKeys && !castTimestamps && !deferred.length) continue;
  await Bun.write(file, ordered.filter((statement) => !deferred.includes(statement)).join("--> statement-breakpoint"));
  console.log("Generated constraint drops and column additions before dependent schema changes.");
}

if (generated.length) {
  const format = Bun.spawn(
    [
      "bunx",
      "--no-install",
      "biome",
      "format",
      "--write",
      journalPath,
      ...generated.map((entry) => join(folder, "meta", `${String(entry.idx).padStart(4, "0")}_snapshot.json`)),
    ],
    { stdin: "inherit", stdout: "inherit", stderr: "inherit" },
  );
  const formatCode = await format.exited;
  if (formatCode) process.exit(formatCode);
}
