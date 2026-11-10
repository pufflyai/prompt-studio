import { Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import type { QuotaReport } from "../quotas";
import { QuotaGraph } from "./quota-graph";

const checkedAt = "2026-11-10T12:00:00Z";
const providers: QuotaReport[] = [
  {
    id: "codex",
    label: "Codex",
    status: "available",
    checkedAt,
    limits: [
      {
        id: "short",
        label: "5-hour window",
        remainingPercent: 72,
        windowMinutes: 300,
        resetsAt: "2026-11-10T15:00:00Z",
      },
      {
        id: "weekly",
        label: "Weekly",
        remainingPercent: 72,
        windowMinutes: 10080,
        resetsAt: "2026-11-16T00:00:00Z",
        history: [
          { at: "2026-11-09T00:00:00Z", usedPercent: 0 },
          { at: "2026-11-09T06:00:00Z", usedPercent: 7 },
          { at: "2026-11-09T12:00:00Z", usedPercent: 8 },
          { at: "2026-11-09T18:00:00Z", usedPercent: 15 },
          { at: "2026-11-10T00:00:00Z", usedPercent: 19 },
          { at: "2026-11-10T06:00:00Z", usedPercent: 24 },
          { at: checkedAt, usedPercent: 28 },
        ],
      },
    ],
  },
  {
    id: "claude",
    label: "Claude Code",
    status: "available",
    checkedAt,
    limits: [
      { id: "short", label: "5-hour window", remainingPercent: 0 },
      { id: "weekly", label: "Weekly", remainingPercent: 94, windowMinutes: 10080, resetsAt: "2026-11-16T00:00:00Z" },
    ],
  },
  {
    id: "opencode",
    label: "OpenCode",
    status: "unavailable",
    checkedAt,
    limits: [],
    message: "No account quota is available.",
  },
  {
    id: "pi",
    label: "Pi",
    status: "unsupported",
    checkedAt,
    limits: [],
    message: "Pi does not expose account quotas.",
  },
];

interface PreviewProps {
  state: "available" | "loading" | "empty" | "error";
}
const Preview = (props: PreviewProps) => {
  const [refreshes, setRefreshes] = useState(0);
  return (
    <Stack gap="xl" w="full">
      <Text textStyle="heading/M">Prompt Studio</Text>
      <QuotaGraph
        providers={props.state === "empty" || props.state === "loading" ? [] : providers}
        loading={props.state === "loading"}
        error={props.state === "error" ? "Could not check quotas. Refresh to try again." : undefined}
        onRefresh={() => setRefreshes(refreshes + 1)}
      />
      {refreshes > 0 && <Text color="fg.muted">Refreshed {refreshes} times</Text>}
    </Stack>
  );
};

export default { title: "Extensions/Home/Agent quotas", component: Preview } satisfies CanvasMeta<typeof Preview>;
export const Graph: CanvasFrame<typeof Preview> = {
  name: "Quota history and weekly target",
  args: { state: "available" },
  controls: {
    state: {
      type: "select",
      options: ["available", "loading", "empty", "error"].map((value) => ({ value, label: value })),
    },
  },
};
