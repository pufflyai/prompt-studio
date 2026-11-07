import { expect, test } from "bun:test";
import { submitWithNativeChatAccount } from "./native-chat-account-submit";
import type { NativeChatHostServices } from "./native-chat-host";

test("queue and ordinary sends respect active account readiness and never dispatch dedicated auth replies", async () => {
  const sent: string[] = [];
  const account: NonNullable<NativeChatHostServices["account"]> = {
    commands: [],
    blocked: true,
    progress: null,
    notice: null,
    assertReady() {
      if (this.blocked) throw new Error("Sign in");
    },
    isCommand: (text) => text.startsWith("/login"),
    submit: async (text) => {
      sent.push(`account:${text}`);
    },
  };
  const send = async () => {
    sent.push("queue");
  };
  await expect(submitWithNativeChatAccount(account, "Edit", send)).rejects.toThrow("Sign in");
  await submitWithNativeChatAccount(account, "/login", send);
  account.blocked = false;
  await submitWithNativeChatAccount(account, "Edit", send);
  account.progress = "Secret input";
  await expect(submitWithNativeChatAccount(account, "secret reply", send)).rejects.toThrow("authentication");
  expect(sent).toEqual(["account:/login", "queue"]);
});
