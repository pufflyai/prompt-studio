import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import { useState } from "react";
import type { DiagnosticView } from "../diagnostics/types";
import { RuntimeDiagnostics } from "./runtime-diagnostics";

export default { title: "Extensions/Performance/Backend diagnostics", component: RuntimeDiagnostics };

export const BackendDiagnostics = () => {
  const [state, setState] = useState("idle");
  let status: DiagnosticView["status"] = "running";
  if (state === "completed") status = "succeeded";
  if (state === "failed") status = "failed";
  const capture: DiagnosticView = {
    id: "00000000-0000-4000-8000-000000000001",
    projectId: "example-project",
    kind: "cpu",
    seconds: 15,
    createdAt: new Date(Date.now() - 15_000).toISOString(),
    startedAt: new Date(Date.now() - 10_000).toISOString(),
    finishedAt: state === "completed" ? new Date().toISOString() : undefined,
    status,
    pid: 1234,
    hostname: "This runtime",
    hasResult: state === "completed",
    error: state === "failed" ? "The runtime stopped before the capture completed." : null,
    summary:
      state === "completed"
        ? {
            durationMs: 10_000,
            unit: "samples",
            total: 240,
            top: [
              { name: "decodeRecord", location: "storage:1", count: 180 },
              { name: "readHistory", location: "history:2", count: 60 },
            ],
            memoryBefore: { rss: 100_000_000, heapUsed: 25_000_000, external: 5_000_000 },
            memoryAfter: { rss: 110_000_000, heapUsed: 28_000_000, external: 6_000_000 },
          }
        : undefined,
  };
  return (
    <Stack gap="md">
      <HStack>
        {["idle", "running", "completed", "failed"].map((value) => (
          <Button key={value} size="xs" variant="ghost" onClick={() => setState(value)}>
            {value}
          </Button>
        ))}
      </HStack>
      <Box p="md" maxW="md">
        <RuntimeDiagnostics
          captures={state === "idle" ? [] : [capture]}
          onStart={() => setState("running")}
          onCancel={() => setState("idle")}
          onExport={() => {}}
        />
      </Box>
    </Stack>
  );
};
