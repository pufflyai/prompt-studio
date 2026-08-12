import type { DesktopState } from "../lifecycle/lifecycle-machine";

export const lifecycleStates: DesktopState[] = [
  { kind: "starting", phase: "discovery" },
  { kind: "starting", phase: "spawning" },
  { kind: "starting", phase: "readiness" },
  {
    kind: "recovery",
    error: {
      code: "runtime_timeout",
      message: "The Prompt Studio runtime did not become ready in time.",
      actions: ["retry", "open_logs", "copy_diagnostics", "quit"],
    },
  },
  { kind: "closing" },
];

export default { title: "Desktop/Lifecycle states" };
