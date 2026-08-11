import { describe, expect, test } from "bun:test";
import { isAllowedIpcSender } from "./ipc-security";

const expected = {
  expectedWebContentsId: 7,
  lifecycleUrl: "pstdio://lifecycle/index.html",
  runtimeOrigin: "http://127.0.0.1:43127",
};

describe("desktop IPC sender validation", () => {
  test("accepts the expected main frame from the runtime or lifecycle document", () => {
    expect(
      isAllowedIpcSender(
        { senderId: 7, senderFrameUrl: "http://127.0.0.1:43127/projects/one", isMainFrame: true },
        expected,
      ),
    ).toBe(true);
    expect(
      isAllowedIpcSender(
        { senderId: 7, senderFrameUrl: "pstdio://lifecycle/index.html#recovery", isMainFrame: true },
        expected,
      ),
    ).toBe(true);
  });

  test("rejects unknown WebContents, subframes, and origin aliases", () => {
    expect(
      isAllowedIpcSender({ senderId: 8, senderFrameUrl: "http://127.0.0.1:43127", isMainFrame: true }, expected),
    ).toBe(false);
    expect(
      isAllowedIpcSender({ senderId: 7, senderFrameUrl: "http://127.0.0.1:43127", isMainFrame: false }, expected),
    ).toBe(false);
    expect(
      isAllowedIpcSender({ senderId: 7, senderFrameUrl: "http://localhost:43127", isMainFrame: true }, expected),
    ).toBe(false);
  });
});
