import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ToolPart } from "../../src/components/chat-ui/components/message-types";
import { ToolInvocationTimeline } from "../../src/components/chat-ui/components/tool-invocation-timeline";

const meta: CanvasMeta<typeof ToolInvocationTimeline> = {
  title: "Proposals/PS-1043 Bounded tool output",
  component: ToolInvocationTimeline,
  args: { labeledBlocks: true },
  description: "Existing tool cards with normal, shortened, running, empty, and failed output. Synthetic data only.",
};
export default meta;

type Frame = CanvasFrame<typeof ToolInvocationTimeline>;
const result = (output: string, status: ToolPart["status"] = "completed") =>
  ({
    type: "tool",
    tool: "exec_command",
    callId: "sample-command",
    actionType: "execute",
    status,
    state: { input: { cmd: "rg -n sample ./fixtures" }, output },
  }) satisfies ToolPart;
const shortened = "fixtures/first.txt:1: sample start\n… 75.8 MB omitted …\nfixtures/last.txt:920: sample end";

export const NormalOutput: Frame = {
  id: "ps-1043-normal-output",
  args: { invocations: [result("fixtures/example.txt:1: sample match\nProcess exited with code 0")] },
};

export const ShortenedOutput: Frame = {
  id: "ps-1043-shortened-output",
  description: "Expand the existing tool card to read the retained start, omitted-size line, and end.",
  args: { invocations: [result(shortened)] },
};

export const RunningOutput: Frame = {
  id: "ps-1043-running-output",
  description: "A sample live tail after output exceeds the allowance; no real command runs.",
  args: { invocations: [result(shortened, "running")] },
};

export const FailedOutput: Frame = {
  id: "ps-1043-failed-output",
  description: "The bounded error detail accompanies the failed command status.",
  args: {
    invocations: [
      {
        ...result(shortened, "failed"),
        state: {
          input: { cmd: "rg -n sample ./fixtures" },
          output: shortened,
          errorText: "Command exited with code 2: permission denied reading fixtures/private.txt",
        },
      },
    ],
  },
};

export const EmptyOutput: Frame = {
  id: "ps-1043-empty-output",
  args: { invocations: [result("")] },
};
