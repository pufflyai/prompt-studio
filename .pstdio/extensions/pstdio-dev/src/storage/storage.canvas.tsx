import { Box, Button, HStack } from "@chakra-ui/react";
import { useState } from "react";
import type { StorageReport } from "../diagnostics/storage";
import { StorageView } from "./storage-view";

const GB = 1e9;
const MB = 1e6;
const table = (name: string, heap: number, large: number, indexes: number) => ({
  name,
  heapBytes: heap,
  largeValueBytes: large,
  indexBytes: indexes,
  totalBytes: heap + large + indexes,
});
const report: StorageReport = {
  generatedAt: "2026-11-15T09:30:00.000Z",
  durationMs: 17_177,
  home: "~/.pstdio",
  database: {
    path: "~/.pstdio/pstdio.db",
    totalBytes: 12.6 * GB,
    walBytes: 1.06 * GB,
    tables: [
      table("storage_documents", 299 * MB, 9.18 * GB, 70 * MB),
      table("storage_ordered_operations", 620 * MB, 45 * MB, 60 * MB),
      table("storage_current_records", 350 * MB, 64 * MB, 38 * MB),
      table("storage_ordered_records", 182 * MB, 31 * MB, 29 * MB),
      table("asset_transfers", 65 * MB, 0, 34 * MB),
    ],
    documents: [
      {
        owner: "pstdio.personal-history.logs-v2",
        kind: "ordered-index-blob",
        rows: 14_755,
        liveBytes: 6.08 * GB,
        deadBytes: 492 * MB,
      },
      {
        owner: "pstdio.pstdio-reports",
        kind: "ordered-index-blob",
        rows: 39_887,
        liveBytes: 106 * MB,
        deadBytes: 20 * MB,
      },
      { owner: "pstdio", kind: "ordered-index-blob", rows: 40_110, liveBytes: 102 * MB, deadBytes: 17 * MB },
      { owner: "pstdio.pstdio-reports", kind: "resource", rows: 73_093, liveBytes: 93 * MB, deadBytes: 0 },
    ],
  },
  files: [
    { group: "app", name: "pstdio.db", path: "~/.pstdio/pstdio.db", bytes: 12.6 * GB, files: 735 },
    {
      group: "project",
      name: "pstdio.pstdio-reports",
      path: ".pstdio/extension-storage/pstdio.pstdio-reports",
      bytes: 9.63 * GB,
      files: 77_212,
    },
    { group: "app", name: "extensions", path: "~/.pstdio/extensions", bytes: 6.05 * GB, files: 457_563 },
    {
      group: "app",
      name: "storage/asset-bytes",
      path: "~/.pstdio/storage/asset-bytes",
      bytes: 5.59 * GB,
      files: 98_826,
    },
    {
      group: "app",
      name: "storage/personal-history",
      path: "~/.pstdio/storage/personal-history",
      bytes: 5.33 * GB,
      files: 8_417,
    },
  ],
  skipped: ["~/.pstdio/workspaces"],
};

export default { title: "Extensions/Prompt Studio Dev/Storage report", fullscreen: true };
export const StorageReportView = () => {
  const [state, setState] = useState("report");
  return (
    <Box h="100dvh" display="flex" flexDirection="column" minH="0">
      <HStack p="sm">
        {["report", "empty", "measuring", "error"].map((value) => (
          <Button key={value} size="xs" onClick={() => setState(value)}>
            {value}
          </Button>
        ))}
      </HStack>
      <Box flex="1" minH="0">
        <StorageView
          report={state === "report" || state === "error" ? report : null}
          measuring={state === "measuring"}
          error={state === "error" ? "ENOENT: no such file or directory, scandir '~/.pstdio/pstdio.db/base'" : null}
          onMeasure={() => {}}
        />
      </Box>
    </Box>
  );
};
