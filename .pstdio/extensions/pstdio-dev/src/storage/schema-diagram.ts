import type { DatabaseSchema } from "../diagnostics/schema";

const label = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const schemaDiagram = (schema: DatabaseSchema, selectedId: string) => {
  const related = new Set([selectedId]);
  for (const table of schema.tables) {
    for (const key of table.foreignKeys) {
      if (table.id === selectedId) related.add(key.target);
      if (key.target === selectedId) related.add(table.id);
    }
  }
  const tables = schema.tables.filter((table) => !selectedId || related.has(table.id));
  const ids = new Map(tables.map((table, index) => [table.id, `t${index}`]));
  const lines = ["flowchart LR"];
  for (const table of tables) {
    const foreign = new Set(table.foreignKeys.flatMap((key) => key.columns));
    const columns = table.columns
      .filter((column) => selectedId || column.primaryKey || foreign.has(column.name))
      .map((column) => {
        const keys = [column.primaryKey ? "PK" : "", foreign.has(column.name) ? "FK" : ""].filter(Boolean);
        return label(`${keys.join(" ")} ${column.name}: ${column.type}`.trim());
      });
    lines.push(`  ${ids.get(table.id)}["${[label(table.id), ...columns].join("<br/>")}"]`);
    for (const key of table.foreignKeys) {
      if (!ids.has(key.target)) continue;
      lines.push(
        `  ${ids.get(table.id)} -->|"${label(`${key.columns.join(", ")} → ${key.targetColumns.join(", ")}`)}"| ${ids.get(key.target)}`,
      );
    }
  }
  return lines.join("\n");
};
