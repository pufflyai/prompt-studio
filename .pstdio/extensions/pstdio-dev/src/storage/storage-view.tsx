import { Button, HStack, SimpleGrid, Stack, Tabs, Text } from "@chakra-ui/react";
import { AlertMessage, EmptyState } from "@pstdio/ui";
import { DataTable } from "@pstdio/ui/data-table";
import { useState } from "react";
import type { DatabaseSchema } from "../diagnostics/schema";
import type { StorageReport } from "../diagnostics/storage";
import { formatValue } from "../webview/format";
import { PageFrame } from "../webview/page-frame";
import { SchemaControls } from "./schema-controls";
import { SchemaView } from "./schema-view";

export interface StorageViewProps {
  report: StorageReport | null;
  measuring: boolean;
  error?: string | null;
  onMeasure: () => void;
  schema: DatabaseSchema | null;
  schemaLoading: boolean;
  schemaError?: string | null;
  onReloadSchema: () => void;
}

const bytes = (value: number) => formatValue(value, "bytes");
// Table cells stay numeric so columns sort by size.
const megabytes = (value: number) => Math.round(value / 1e5) / 10;
// Out-of-line values above this share of the database mean it stores blobs (rule 0006.2.16).
const BLOB_SHARE_WARNING = 0.25;

const Figure = (props: { label: string; value: string; detail?: string }) => (
  <Stack gap="3xs" p="md" borderWidth="1px" borderColor="border.subtle" borderRadius="md">
    <Text textStyle="label/S/regular" color="fg.muted">
      {props.label}
    </Text>
    <Text textStyle="heading/S">{props.value}</Text>
    {props.detail ? (
      <Text textStyle="label/S/regular" color="fg.muted">
        {props.detail}
      </Text>
    ) : null}
  </Stack>
);

const Section = (props: { title: string; description: string; children: React.ReactNode }) => (
  <Stack gap="xs">
    <Stack gap="xs" px="sm">
      <Text textStyle="label/M/medium">{props.title}</Text>
      <Text textStyle="label/S/regular" color="fg.muted">
        {props.description}
      </Text>
    </Stack>
    {props.children}
  </Stack>
);

const Report = (props: { report: StorageReport; schema: DatabaseSchema | null; onSelect: (id: string) => void }) => {
  const { report, schema, onSelect } = props;
  const { database } = report;
  const largeValues = database.tables.reduce((sum, table) => sum + table.largeValueBytes, 0);
  const sum = (group: "app" | "project") =>
    report.files.filter((area) => area.group === group).reduce((total, area) => total + area.bytes, 0);
  const blobShare = database.totalBytes ? largeValues / database.totalBytes : 0;
  return (
    <>
      <SimpleGrid columns={{ base: 2, md: 4 }} gap="sm" p="sm">
        <Figure
          label="Database"
          value={bytes(database.totalBytes)}
          detail={`${bytes(database.walBytes)} write-ahead log`}
        />
        <Figure
          label="Large values in the database"
          value={bytes(largeValues)}
          detail={`${Math.round(blobShare * 100)}% of it`}
        />
        <Figure label="App data folder" value={bytes(sum("app"))} detail={report.home} />
        <Figure label="Project extension storage" value={bytes(sum("project"))} />
      </SimpleGrid>
      {blobShare > BLOB_SHARE_WARNING ? (
        <AlertMessage status="warning" title="The database stores blobs">
          {bytes(largeValues)} of the database is out-of-line large values. The database should hold structured data and
          references only (rule 0006.2.16); bytes belong in file storage.
        </AlertMessage>
      ) : null}
      <Section
        title="Database tables"
        description="On-disk size per table. Large values are field values Postgres stores out of line (TOAST): in practice, blobs."
      >
        <DataTable
          fullWidth
          noBorder
          data={database.tables.map((table) => ({
            id: table.name,
            table: table.name,
            total: megabytes(table.totalBytes),
            rows: megabytes(table.heapBytes),
            large: megabytes(table.largeValueBytes),
            indexes: megabytes(table.indexBytes),
          }))}
          hiddenColumns={["id"]}
          getRowId={(row) => String(row.id)}
          initialPageSize={10}
          defaultSettings={{ rowNumbers: false }}
          compactHeaders={{
            table: "Table",
            total: "Total (MB)",
            rows: "Rows (MB)",
            large: "Large values (MB)",
            indexes: "Indexes (MB)",
          }}
          toolbarStorageKey="storage-report-tables"
          itemLabel="table"
          onRowClick={(row) => {
            const table = schema?.tables.find((table) => table.name === row.table);
            if (table) onSelect(table.id);
          }}
          isRowInteractive={(row) => Boolean(schema?.tables.some((table) => table.name === row.table))}
        />
      </Section>
      <Section
        title="Stored documents by owner"
        description="Estimated state bytes by extension and document kind, sampled from a running database. Unknown bytes have no confirmed transaction state."
      >
        <DataTable
          fullWidth
          noBorder
          data={database.documents.map((group) => ({
            id: `${group.owner}/${group.kind}`,
            owner: group.owner,
            kind: group.kind,
            rows: group.rows,
            live: megabytes(group.liveBytes),
            dead: megabytes(group.deadBytes),
            unknown: megabytes(group.unknownBytes ?? 0),
          }))}
          hiddenColumns={["id"]}
          getRowId={(row) => String(row.id)}
          initialPageSize={10}
          defaultSettings={{ rowNumbers: false }}
          compactHeaders={{
            owner: "Owner",
            kind: "Kind",
            rows: "Rows",
            live: "Live (MB)",
            dead: "Dead (MB)",
            unknown: "Unknown (MB)",
          }}
          filterableColumns={["owner", "kind"]}
          toolbarStorageKey="storage-report-documents"
          itemLabel="group"
        />
      </Section>
      <Section
        title="Files"
        description="App data folder entries and this project's extension storage folders, largest first."
      >
        <DataTable
          fullWidth
          noBorder
          data={report.files.map((area) => ({
            id: area.path,
            location: area.group === "app" ? "App data" : "Project",
            area: area.name,
            size: megabytes(area.bytes),
            files: area.files,
          }))}
          hiddenColumns={["id"]}
          getRowId={(row) => String(row.id)}
          initialPageSize={15}
          defaultSettings={{ rowNumbers: false }}
          compactHeaders={{ location: "Location", area: "Folder", size: "Size (MB)", files: "Files" }}
          filterableColumns={["location"]}
          toolbarStorageKey="storage-report-files"
          itemLabel="folder"
        />
        {report.skipped.length ? (
          <Text textStyle="label/S/regular" color="fg.muted">
            Not measured, because they hold dependency trees: {report.skipped.join(", ")}.
          </Text>
        ) : null}
      </Section>
    </>
  );
};

export const StorageView = (props: StorageViewProps) => {
  const { report, measuring, error, onMeasure, schema, schemaLoading, schemaError, onReloadSchema } = props;
  const [tab, setTab] = useState("storage");
  const [selectedId, setSelectedId] = useState("");
  const selectTable = (id: string) => {
    setSelectedId(id);
    setTab("schema");
  };
  return (
    <Tabs.Root
      value={tab}
      onValueChange={(event) => setTab(event.value)}
      size="sm"
      h="full"
      minH="0"
      display="flex"
      flexDirection="column"
      lazyMount
      unmountOnExit
    >
      <PageFrame
        fullWidth
        headerPadding="sm"
        contentPadding="none"
        toolbar={
          <>
            <HStack w="full" justify="space-between">
              <Tabs.List>
                <Tabs.Trigger value="storage">Storage</Tabs.Trigger>
                <Tabs.Trigger value="schema">Schema</Tabs.Trigger>
                <Tabs.Trigger value="graph">Graph</Tabs.Trigger>
              </Tabs.List>
              {tab === "storage" ? (
                <Button size="xs" variant="outline" loading={measuring} onClick={onMeasure}>
                  Measure
                </Button>
              ) : (
                <Button size="xs" variant="outline" loading={schemaLoading} onClick={onReloadSchema}>
                  Reload schema
                </Button>
              )}
            </HStack>
            {tab === "storage" ? (
              <Text textStyle="label/XS" color="fg.muted">
                {report
                  ? `Measured ${new Date(report.generatedAt).toLocaleString()} in ${(report.durationMs / 1000).toFixed(1)} s`
                  : "Database and file storage sizes"}
              </Text>
            ) : null}
            {tab !== "storage" && schema ? (
              <SchemaControls schema={schema} selectedId={selectedId} onSelect={setSelectedId} />
            ) : null}
          </>
        }
      >
        <Tabs.Content value="storage" p="0">
          <Stack gap="lg">
            {error ? (
              <AlertMessage status="error" title="Measuring storage failed">
                {error}
              </AlertMessage>
            ) : null}
            {report ? (
              <Report report={report} schema={schema} onSelect={selectTable} />
            ) : (
              <EmptyState
                title={measuring ? "Measuring storage" : "No storage report yet"}
                description="Measuring reads the database files and walks the data folders. It takes about 20 seconds and does not open the database."
              />
            )}
          </Stack>
        </Tabs.Content>
        {["schema", "graph"].map((value) => (
          <Tabs.Content key={value} value={value} p="0">
            {schemaError ? (
              <AlertMessage status="error" title="Reading the database schema failed">
                {schemaError}
              </AlertMessage>
            ) : null}
            {schema ? (
              <SchemaView schema={schema} selectedId={selectedId} graph={value === "graph"} onSelect={setSelectedId} />
            ) : (
              <EmptyState title={schemaLoading ? "Reading database schema" : "No database schema available"} />
            )}
          </Tabs.Content>
        ))}
      </PageFrame>
    </Tabs.Root>
  );
};
