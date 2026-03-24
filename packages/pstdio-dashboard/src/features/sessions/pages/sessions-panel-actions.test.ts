import { describe, expect, it } from "bun:test";
import { openSessionBubbleAndGoBack } from "./sessions-panel-actions";

describe("openSessionBubbleAndGoBack", () => {
  it("opens the bubble with the selected session and navigates back", () => {
    const events: string[] = [];

    openSessionBubbleAndGoBack({
      sessionId: "session-24",
      setSessionModalState: (state) => {
        events.push(`state:${state}`);
      },
      setSelectedSessionId: (sessionId) => {
        events.push(`session:${sessionId}`);
      },
      navigateBack: () => {
        events.push("navigate");
      },
    });

    expect(events).toEqual(["state:bubble", "session:session-24", "navigate"]);
  });
});
