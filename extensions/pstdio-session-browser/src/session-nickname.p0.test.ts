import { expect, test } from "bun:test";
import { sessionNickname } from "./session-nickname";

test("nicknames stay short and distinguish sessions created at the same time", () => {
  expect(sessionNickname("019a6810-f835-7000-8000-000000000001")).toBe("still-eldema");
  const nicknames = Array.from({ length: 300 }, (_, i) => {
    const id = `019a6810-f835-7000-8000-${String(i).padStart(12, "0")}`;
    const name = sessionNickname(id);
    expect(name).toMatch(/^[a-z]+-[a-z]+$/);
    expect(name.length).toBeLessThanOrEqual(16);
    return name;
  });
  expect(new Set(nicknames).size).toBe(nicknames.length);
});
