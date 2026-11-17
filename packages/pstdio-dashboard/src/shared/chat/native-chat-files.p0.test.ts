import { expect, test } from "bun:test";
import { nativeChatFileAllowed } from "./native-chat-files";

test("native file rendering authenticates only current-project attachments and provider-owned files", () => {
  const allowed = (url: string) => nativeChatFileAllowed(url, "project", "acme.chat");
  expect(allowed("/v1/projects/project/session-attachments/file/content")).toBe(true);
  expect(allowed("/v1/projects/project/extensions/acme.chat/files/file/content")).toBe(true);
  for (const path of [
    "/v1/projects/other/session-attachments/file/content",
    "/v1/projects/project/extensions/other.chat/files/file/content",
    "/v1/projects/project/session-attachments/../secrets/content",
    "/v1/projects/project/session-attachments/%2E%2E/content",
    "/v1/projects/project/session-attachments/%2Fsecrets/content",
    "/v1/projects/project/session-attachments/file/content?secret=true",
    "https://outside.test/v1/projects/project/session-attachments/file/content",
    "/v1/account/status",
  ])
    expect(allowed(path)).toBe(false);
  expect(nativeChatFileAllowed("/v1/projects/project/session-attachments/file/content", undefined, "acme.chat")).toBe(
    false,
  );
});
