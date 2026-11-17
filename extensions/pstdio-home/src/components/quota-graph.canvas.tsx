import { Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { QuotaReport } from "../quotas";
import { QuotaGraph } from "./quota-graph";

const checkedAt = "2026-11-10T12:00:00Z";
const providers: QuotaReport[] = [
  {
    id: "harness-codex",
    label: "Codex",
    icon: "terminal",
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
    id: "harness-claude-code",
    label: "Claude Code",
    icon: "sparkles",
    status: "available",
    checkedAt,
    limits: [
      { id: "short", label: "5-hour window", remainingPercent: 0 },
      { id: "weekly", label: "Weekly", remainingPercent: 94, windowMinutes: 10080, resetsAt: "2026-11-16T00:00:00Z" },
    ],
  },
  {
    id: "harness-open-code",
    label: "OpenCode",
    icon: "square-terminal",
    status: "unavailable",
    checkedAt,
    limits: [],
    message: "No account quota is available.",
  },
  {
    id: "harness-pi",
    label: "Pi",
    icon: "pi",
    status: "unsupported",
    checkedAt,
    limits: [],
    message: "Pi does not expose account quotas.",
  },
];

interface PreviewProps {
  state: "one-window" | "single" | "multiple" | "first-point" | "loading" | "empty" | "error";
}
const Preview = (props: PreviewProps) => {
  const examples = props.state === "multiple" ? providers : providers.slice(0, 1);
  const reports = examples.map((provider) => {
    const limits = ["one-window", "first-point"].includes(props.state) ? provider.limits.slice(1) : provider.limits;
    return {
      ...provider,
      limits: props.state === "first-point" ? limits.map(({ history: _history, ...limit }) => limit) : limits,
    };
  });
  return (
    <Stack gap="xl" w="full">
      <Text textStyle="heading/M">Prompt Studio</Text>
      <QuotaGraph
        providers={props.state === "empty" || props.state === "loading" ? [] : reports}
        loading={props.state === "loading"}
        error={props.state === "error" ? "Could not check quotas. Retrying automatically." : undefined}
      />
    </Stack>
  );
};

export default { title: "Extensions/Home/Agent quotas", component: Preview } satisfies CanvasMeta<typeof Preview>;
export const Graph: CanvasFrame<typeof Preview> = {
  name: "Automatic quota history",
  description:
    "One quota graph fills the width and shows its harness name/icon on the usage summary row. Two quota windows sit side by side, stacking on narrow screens. Usage always begins at zero at the period start. Keep Usage, Forecast and Limit legends and a solid yellow forecast. Multiple harnesses use a dropdown. Icons here are synthetic; installed harness icons come from public extension metadata.",
  args: { state: "one-window" },
  controls: {
    state: {
      type: "select",
      options: ["one-window", "single", "multiple", "first-point", "loading", "empty", "error"].map((value) => ({
        value,
        label: value,
      })),
    },
  },
};
