import { Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { QuotaHistoryChart } from "./quota-history-chart";

const start = Date.parse("2026-11-09T00:00:00Z");
const end = start + 7 * 86400000;
const history = [0, 7, 8, 15, 19, 24, 28].map((used, index) => ({ time: start + index * 6 * 3600000, used }));
const Preview = () => (
  <Stack gap="lg" w="full">
    <QuotaHistoryChart
      label="Codex · Weekly"
      remainingPercent={72}
      resetsAt={new Date(end).toISOString()}
      history={history}
      target={[
        { time: start, used: 0 },
        { time: end, used: 100 },
      ]}
      forecast={[history.at(-1)!, { time: end, used: 131 }]}
      start={start}
      end={end}
    />
  </Stack>
);
export default { title: "Proposals/PS-193 Quota history", component: Preview } satisfies CanvasMeta<typeof Preview>;
export const History: CanvasFrame<typeof Preview> = { name: "Weekly usage, forecast, and target", args: {} };
