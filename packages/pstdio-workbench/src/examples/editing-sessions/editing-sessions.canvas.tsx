import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { EditingSessionsPlayground } from "./editing-sessions-playground.fixture";

const meta = {
  title: "pstdio-workbench/Reference/Extension API/Shared editing sessions",
  component: EditingSessionsPlayground,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Use the real SDK editing client, capability gate, host event publisher and host-owned save queue. Only the transport and persistence are in memory. Views share edits before saving, coalesce pending writes, and preview or cancel compound changes. Sandboxed iframe transport is covered by the packaged editing-session journeys.",
      },
    },
  },
} satisfies CanvasMeta<typeof EditingSessionsPlayground>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Playground: Story = {
  id: "pstdio-workbench-reference-extension-api-shared-editing-sessions--playground",
};
export const HeldSavesAndGestures: Story = {
  id: "pstdio-workbench-reference-extension-api-shared-editing-sessions--held-saves-and-gestures",
};
export const FailedSaveRetry: Story = {
  id: "pstdio-workbench-reference-extension-api-shared-editing-sessions--failed-save-retry",
};
