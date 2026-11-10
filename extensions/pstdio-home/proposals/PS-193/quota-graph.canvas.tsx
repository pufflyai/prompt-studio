import { Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { QuotaGraph, type QuotaReport } from "./quota-graph";

const checkedAt = "2026-11-10T12:00:00Z";
const providers: QuotaReport[] = [
  {
    id: "codex",
    label: "Codex",
    status: "available",
    checkedAt,
    limits: [
      { id: "short", label: "5-hour window", remainingPercent: 72 },
      { id: "weekly", label: "Weekly", remainingPercent: 28 },
    ],
  },
  {
    id: "claude",
    label: "Claude Code",
    status: "available",
    checkedAt,
    limits: [
      { id: "short", label: "5-hour window", remainingPercent: 0 },
      { id: "weekly", label: "Weekly", remainingPercent: 94 },
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

export default { title: "Proposals/PS-193 Agent quotas on Home", component: Preview } satisfies CanvasMeta<
  typeof Preview
>;
export const Graph: CanvasFrame<typeof Preview> = {
  name: "Quota graph",
  args: { state: "available" },
  controls: {
    state: {
      type: "select",
      options: ["available", "loading", "empty", "error"].map((value) => ({ value, label: value })),
    },
  },
};
