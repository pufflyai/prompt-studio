import { Button, Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { DataTable } from "@pstdio/ui/data-table";
import { MermaidRenderer } from "@pstdio/ui/mermaid";
import type { DatabaseSchema, SchemaTable } from "../diagnostics/schema";
import { schemaDiagram } from "./schema-diagram";

interface SchemaViewProps {
  schema: DatabaseSchema;
  selectedId: string;
  graph: boolean;
  onSelect: (id: string) => void;
}

const TableDetails = (props: { table: SchemaTable; onSelect: (id: string) => void }) => {
  const { table, onSelect } = props;
  return (
    <Stack gap="lg" minW="0">
      <DataTable
        key={table.id}
        fullWidth
        noBorder
        data={table.columns.map((column) => ({
          column: column.name,
          type: column.type,
          primary: column.primaryKey,
          nullable: column.nullable,
          default: column.default ?? "—",
          values: column.values.join(", ") || "—",
        }))}
        getRowId={(row) => String(row.column)}
        defaultSettings={{ rowNumbers: false }}
        initialPageSize={100}
        compactHeaders={{
          column: "Column",
          type: "Type",
          primary: "Primary key",
          nullable: "Nullable",
          default: "Default",
          values: "Enum values",
        }}
        toolbarStorageKey="storage-schema-columns"
        itemLabel="column"
      />
      <Stack gap="xs">
        <Text px="sm" textStyle="label/M/medium">
          Foreign keys
        </Text>
        {table.foreignKeys.length ? (
          <DataTable
            fullWidth
            noBorder
            data={table.foreignKeys.map((key) => ({
              name: key.name,
              columns: key.columns.join(", "),
              target: key.target,
              references: key.targetColumns.join(", "),
              onDelete: key.onDelete,
              onUpdate: key.onUpdate,
            }))}
            getRowId={(row) => String(row.name)}
            onRowClick={(row) => onSelect(String(row.target))}
            defaultSettings={{ rowNumbers: false }}
            compactHeaders={{
              name: "Constraint",
              columns: "Columns",
              target: "Referenced table",
              references: "Referenced columns",
              onDelete: "On delete",
              onUpdate: "On update",
            }}
            toolbarStorageKey="storage-schema-foreign-keys"
            itemLabel="foreign key"
          />
        ) : (
          <Text px="sm" color="fg.muted" textStyle="label/S/regular">
            No foreign keys.
          </Text>
        )}
      </Stack>
      <Stack gap="xs">
        <Text px="sm" textStyle="label/M/medium">
          Indexes and unique constraints
        </Text>
        {table.indexes.length ? (
          <DataTable
            fullWidth
            noBorder
            data={table.indexes.map((index) => ({
              name: index.name,
              columns: index.columns.join(", "),
              unique: index.unique,
              method: index.method,
            }))}
            getRowId={(row) => String(row.name)}
            defaultSettings={{ rowNumbers: false }}
            compactHeaders={{ name: "Name", columns: "Columns", unique: "Unique", method: "Method" }}
            toolbarStorageKey="storage-schema-indexes"
            itemLabel="index"
          />
        ) : (
          <Text px="sm" color="fg.muted" textStyle="label/S/regular">
            No indexes or unique constraints.
          </Text>
        )}
      </Stack>
    </Stack>
  );
};

export const SchemaView = (props: SchemaViewProps) => {
  const { schema, selectedId, graph, onSelect } = props;
  const selected = schema.tables.find((table) => table.id === selectedId);
  if (!schema.tables.length) return <EmptyState title="No tables in this schema snapshot" />;
  if (graph)
    return (
      <Stack gap="sm" p="sm">
        <Text color="fg.muted" textStyle="label/S/regular">
          {selected
            ? `${selected.id} and its related tables. All columns shown.`
            : "All tables. Primary and foreign key columns shown."}{" "}
          Arrows point to referenced tables.
        </Text>
        <MermaidRenderer code={schemaDiagram(schema, selected?.id ?? "")} />
        {selected ? (
          <Button alignSelf="start" variant="ghost" size="xs" onClick={() => onSelect("")}>
            Show entire schema
          </Button>
        ) : null}
      </Stack>
    );
  if (selected) return <TableDetails table={selected} onSelect={onSelect} />;
  return (
    <DataTable
      fullWidth
      noBorder
      data={schema.tables.map((table) => ({
        id: table.id,
        schema: table.schema,
        table: table.name,
        columns: table.columns.length,
        foreignKeys: table.foreignKeys.length,
        indexes: table.indexes.length,
      }))}
      hiddenColumns={["id"]}
      getRowId={(row) => String(row.id)}
      onRowClick={(row) => onSelect(String(row.id))}
      defaultSettings={{ rowNumbers: false }}
      initialPageSize={100}
      compactHeaders={{
        schema: "Schema",
        table: "Table",
        columns: "Columns",
        foreignKeys: "Foreign keys",
        indexes: "Indexes",
      }}
      filterableColumns={["schema"]}
      toolbarStorageKey="storage-schema-tables"
      itemLabel="table"
    />
  );
};
