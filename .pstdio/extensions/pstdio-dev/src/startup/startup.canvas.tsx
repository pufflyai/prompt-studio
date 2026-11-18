import { Box, Button, HStack } from "@chakra-ui/react";
import { useState } from "react";
import type { Launch } from "../diagnostics/timeline";
import { StartupView } from "./startup-view";

const PROJECT = "1257196a-9972-47ba-be62-7e60e51a3840";
const startup = (scale: number) =>
  [
    ["database_locked", 116],
    ["database_engine_loaded", 131],
    ["database_opened", 301],
    ["database_migrated", 332],
    ["extensions_ready", 3032 * scale],
    ["app_ready", 3073 * scale],
  ].map(([phase, atMs], index, all) => ({
    phase: phase as string,
    atMs: atMs as number,
    durationMs: (atMs as number) - ((all[index - 1]?.[1] as number) ?? 0),
  }));
const setup = (filesMs: number) => {
  const steps = [
    ["project.config", 0, 231, 0],
    ["project.extensions", 231, 0, 0],
    ["project.defaults", 231, 0, 0],
    ["project.repo_extensions", 232, 961, 0],
    ["default_extensions.checkout", 232, 958, 1],
    ["project.repo_sync", 1193, 35, 0],
    ["project.files", 1228, filesMs, 0],
    ["project.provision", 1228 + filesMs, 600, 0],
  ].map(([phase, startMs, durationMs, depth]) => ({
    phase: phase as string,
    startMs: startMs as number,
    durationMs: durationMs as number,
    state: "completed" as const,
    depth: depth as number,
  }));
  return { projectId: PROJECT, outcome: "completed" as const, steps, durationMs: 1828 + filesMs };
};
const launches: Launch[] = [84_177, 183_660, 42_028, 32_899, 12_686, 6_590].map((filesMs, index) => {
  const startedAt = new Date(Date.UTC(2026, 10, 15 - index * 2, 8, 9, 32)).toISOString();
  return {
    id: startedAt,
    startedAt,
    readyMs: startup(1 + index * 0.1).at(-1)!.atMs,
    startup: startup(1 + index * 0.1),
    setups: [{ ...setup(filesMs), startedAt: new Date(Date.parse(startedAt) + 25_000).toISOString() }],
    endedAt: index ? new Date(Date.parse(startedAt) + 3_600_000).toISOString() : null,
    ended: index ? "quit" : "running",
  };
});

export default { title: "Extensions/Prompt Studio Dev/Startup timeline", fullscreen: true };
export const StartupTimeline = () => {
  const [state, setState] = useState("history");
  return (
    <Box h="100dvh" display="flex" flexDirection="column" minH="0">
      <HStack p="sm">
        {["history", "empty", "error"].map((value) => (
          <Button key={value} size="xs" onClick={() => setState(value)}>
            {value}
          </Button>
        ))}
      </HStack>
      <Box flex="1" minH="0">
        <StartupView
          launches={state === "empty" ? [] : launches}
          projectNames={{ [PROJECT]: "Prompt Studio" }}
          logPath="~/.pstdio/logs.jsonl"
          loading={false}
          error={state === "error" ? "ENOENT: no such file or directory, open '~/.pstdio/logs.jsonl'" : undefined}
          onRefresh={() => {}}
        />
      </Box>
    </Box>
  );
};
