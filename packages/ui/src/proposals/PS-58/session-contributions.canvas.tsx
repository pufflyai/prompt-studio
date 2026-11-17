import type { CanvasMeta } from "@pstdio/canvas";
import { SessionContributions } from "./session-contributions";

export default {
  title: "Proposals/PS-58 Session contribution points",
  component: SessionContributions,
  args: {
    showBounds: true,
    narrow: false,
    pet: true,
    workspaces: true,
    harness: true,
    footer: true,
    reducedMotion: false,
    context: "draft",
    status: "ready",
    time: 0,
  },
  controls: {
    showBounds: { type: "boolean", label: "Show names and shapes" },
    narrow: { type: "boolean", label: "Narrow panel" },
    pet: { type: "boolean", label: "Top contribution: pet" },
    workspaces: { type: "boolean", label: "Workspace contribution enabled" },
    harness: { type: "boolean", label: "Harness contributions enabled" },
    footer: { type: "boolean", label: "Bottom contributions enabled" },
    reducedMotion: { type: "boolean", label: "Reduced motion" },
    context: {
      type: "select",
      label: "Subject",
      options: [
        { value: "draft", label: "New session" },
        { value: "saved", label: "Saved session" },
      ],
    },
    status: {
      type: "select",
      label: "Workspace contribution status",
      options: [
        { value: "ready", label: "Ready" },
        { value: "loading", label: "Loading" },
        { value: "error", label: "Failure" },
      ],
    },
  },
} satisfies CanvasMeta<typeof SessionContributions>;

export const ComposerContributions = {
  motion: {
    duration: 8,
    fps: 30,
    markers: [
      { at: 0, label: "Left" },
      { at: 4, label: "Right" },
      { at: 8, label: "Left" },
    ],
  },
};
