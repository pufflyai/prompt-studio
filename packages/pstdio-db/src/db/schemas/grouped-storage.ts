import { bigint, foreignKey, index, jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import type { Acceptance, LocalOperation } from "pstdio-sync";
import type { AcceptedHeader } from "./grouped-storage-types";
import { projects } from "./projects";

export const extension_storage_owners = pgTable(
  "extension_storage_owners",
  {
    workbench_id: text("workbench_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    accepted_json: jsonb("accepted_json").$type<AcceptedHeader>(),
    revision: uuid("revision").notNull().defaultRandom(),
  },
  (table) => [primaryKey({ columns: [table.workbench_id, table.extension_id] })],
);

export const extension_storage_journal = pgTable(
  "extension_storage_journal",
  {
    workbench_id: text("workbench_id").notNull(),
    extension_id: text("extension_id").notNull(),
    operation_id: text("operation_id").notNull(),
    ordinal: bigint("ordinal", { mode: "number" }).notNull(),
    input_fingerprint: text("input_fingerprint").notNull(),
    mutation_json: jsonb("mutation_json").$type<LocalOperation>().notNull(),
    acceptance_json: jsonb("acceptance_json").$type<Acceptance>(),
    recovery_proof: text("recovery_proof"),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.extension_id, table.operation_id] }),
    foreignKey({
      columns: [table.workbench_id, table.extension_id],
      foreignColumns: [extension_storage_owners.workbench_id, extension_storage_owners.extension_id],
    }).onDelete("cascade"),
    index("extension_storage_journal_order_idx").on(table.workbench_id, table.extension_id, table.ordinal),
  ],
);
