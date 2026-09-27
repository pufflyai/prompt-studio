import type { Preset } from "./presets";

export type { Preset } from "./presets";
export const FPS = 60;
export type StudyId =
  | "chat-turn"
  | "loaders"
  | "streaming"
  | "tools-queue"
  | "panels"
  | "surfaces"
  | "rows"
  | "tabs"
  | "navigation-tree";
export interface Variant {
  preset: Preset;
  loader: "spinner" | "pulse" | "scan" | "aurora" | "contours";
  streaming: "append" | "fade" | "words";
}
export interface StudyProps extends Record<string, unknown> {
  study: StudyId;
  comparison: boolean;
  theme: "dark" | "light";
  reducedMotion: boolean;
  left: Variant;
  right: Variant;
}
export const defaultProps: StudyProps = {
  study: "chat-turn",
  comparison: true,
  theme: "dark",
  reducedMotion: false,
  left: { preset: "instant", loader: "spinner", streaming: "append" },
  right: { preset: "subtle", loader: "aurora", streaming: "words" },
};
export interface SceneProps {
  time: number;
  variant: Variant;
  reducedMotion: boolean;
}
export interface StudyDefinition {
  id: StudyId;
  title: string;
  description: string;
  duration: number;
  markers: { at: number; label: string }[];
}
export const studies: StudyDefinition[] = [
  {
    id: "chat-turn",
    title: "Chat turn",
    description: "Follow a new message without moving the composer or replaying the history.",
    duration: 12,
    markers: [
      { at: 1, label: "Send" },
      { at: 1.3, label: "Wait" },
      { at: 3, label: "First response" },
      { at: 5, label: "Stream" },
      { at: 9, label: "Complete" },
    ],
  },
  {
    id: "loaders",
    title: "Working styles",
    description:
      "Compare spinner, pulse, scanning line, aurora, and contour field in the same active-turn footer. Judge distraction, readable text, interruption, and completion. Shader-style fields use frame-driven SVG; elapsed time stays fixed above the composer.",
    duration: 14,
    markers: [
      { at: 1, label: "Fast response" },
      { at: 2, label: "Sustained wait" },
      { at: 7, label: "Interrupt" },
      { at: 8.5, label: "New turn" },
      { at: 12, label: "Complete" },
    ],
  },
  {
    id: "streaming",
    title: "Streaming text",
    description:
      "Close-up of the session. Compare immediate append, a 240 ms chunk fade, and a word reveal over 600 ms. Word reveal delays readability within each received chunk; older text stays unchanged. Instant and reduced motion show text immediately.",
    duration: 14,
    markers: [
      { at: 1, label: "First words" },
      { at: 3, label: "Burst" },
      { at: 5, label: "Code" },
      { at: 7, label: "Read earlier" },
      { at: 9, label: "Background arrivals" },
      { at: 11, label: "Follow response" },
    ],
  },
  {
    id: "tools-queue",
    title: "Tools and follow-ups",
    description: "Tool details reveal locally. Queued prompts make room above the stationary composer.",
    duration: 14,
    markers: [
      { at: 1, label: "Tool starts" },
      { at: 2, label: "Expand" },
      { at: 4, label: "Queue first" },
      { at: 5.5, label: "Queue second" },
      { at: 7, label: "Remove first" },
      { at: 8, label: "Tool finishes" },
      { at: 10, label: "Next turn" },
    ],
  },
  {
    id: "panels",
    title: "Panel reveals",
    description: "Panel contents retain their final geometry. Reverse midway and resize directly with the pointer.",
    duration: 14,
    markers: [
      { at: 1, label: "Side opens" },
      { at: 3, label: "Side closes" },
      { at: 4, label: "Open" },
      { at: 4.09, label: "Reverse" },
      { at: 5, label: "Open again" },
      { at: 7, label: "Drag divider" },
      { at: 9, label: "Terminal opens" },
      { at: 11, label: "Terminal closes" },
      { at: 12, label: "Terminal opens" },
      { at: 12.09, label: "Reverse terminal" },
    ],
  },
  {
    id: "surfaces",
    title: "Temporary surfaces",
    description: "A tooltip waits 300 ms. Switching content inside an open dialog does not replay its entrance.",
    duration: 13,
    markers: [
      { at: 1, label: "Menu opens" },
      { at: 2.5, label: "Menu closes" },
      { at: 3, label: "Hover" },
      { at: 3.3, label: "Tooltip" },
      { at: 5, label: "Dialog opens" },
      { at: 7, label: "Change content" },
      { at: 9, label: "Dialog closes" },
      { at: 10, label: "Rapid reversal" },
    ],
  },
  {
    id: "rows",
    title: "Row creation",
    description:
      "Create a folder among existing files, then cancel another. Space opens over 140 ms before the new row fades in over 80 ms. Empty names disable Create folder.",
    duration: 8,
    markers: [
      { at: 1, label: "New folder" },
      { at: 2, label: "Name entered" },
      { at: 3, label: "Create" },
      { at: 4.5, label: "Create another" },
      { at: 5.5, label: "Cancel" },
    ],
  },
  {
    id: "tabs",
    title: "Tab closing and sizing",
    description:
      "Close three neighboring tabs at the same pointer position. Each gap closes over 120 ms without resizing the remaining tabs. At 4s, a crowded strip shrinks to the 48 px minimum.",
    duration: 7,
    markers: [
      { at: 1, label: "Close tab" },
      { at: 1.5, label: "Close next" },
      { at: 2, label: "Close next" },
      { at: 4, label: "48 px minimum" },
    ],
  },
  {
    id: "navigation-tree",
    title: "Navigation tree",
    description:
      "Close-up of the Sidenav tree. Expand a group and a nested workspace, select a session immediately, and reverse a collapse. Children reveal over 160 ms and close over 120 ms; siblings move with the group. Hover actions appear immediately and remain for 150 ms after exit. Compare Instant with Subtle, or use Slower to inspect the reflow.",
    duration: 10,
    markers: [
      { at: 1, label: "Expand workspaces" },
      { at: 2, label: "Expand workspace" },
      { at: 3, label: "Select session" },
      { at: 3.5, label: "Hover actions" },
      { at: 4, label: "Leave row" },
      { at: 4.1, label: "Return before delay" },
      { at: 4.5, label: "Leave row" },
      { at: 5, label: "Collapse group" },
      { at: 6, label: "Expand" },
      { at: 6.08, label: "Reverse" },
      { at: 7, label: "Expand again" },
      { at: 8, label: "Collapse workspace" },
    ],
  },
];
export const getStudy = (id: StudyId) => studies.find((study) => study.id === id)!;
