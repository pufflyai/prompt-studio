import { describe, expect, it } from "bun:test";
import { conversationScrollButtonContainerDefaultProps } from "./ai-conversation";

describe("conversationScrollButtonContainerDefaultProps", () => {
  it("keeps the scroll-to-bottom control above sticky user messages", () => {
    expect(conversationScrollButtonContainerDefaultProps.zIndex).toBeGreaterThan(1);
  });
});
