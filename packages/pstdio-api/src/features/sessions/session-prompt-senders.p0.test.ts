import { expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createSessionConversation } from "./session-conversation";

const prompt = (id: string, text = "Check the build"): SessionMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});
const sender = { type: "session" as const, id: "other-session", name: "Release checks" };

test("attributes only the newly delivered prompt and retains its sender after native replacement", () => {
  const conversation = createSessionConversation(createEventStore(), [prompt("old")]);
  conversation.attributePrompt("Check the build", sender);
  conversation.push({ op: "replace", path: "/messages", value: [prompt("old"), prompt("echo")] });
  expect(conversation.getMessages()[0].sender).toBeUndefined();
  expect(conversation.getMessages()[1].sender).toEqual(sender);
  conversation.push({ op: "replace", path: "/messages", value: [prompt("old"), prompt("native")] });
  expect(conversation.getMessages()[1].sender).toEqual(sender);
  conversation.push({ op: "add", path: "/messages/2", value: prompt("later") });
  expect(conversation.getMessages()[2].sender).toBeUndefined();
});

test("a rejected steering delivery cannot attribute a later identical prompt", () => {
  const conversation = createSessionConversation(createEventStore());
  const cancel = conversation.attributePrompt("Check the build", sender, "rejected-delivery");
  cancel();
  conversation.push({ op: "add", path: "/messages/0", value: prompt("later") });
  expect(conversation.getMessages()[0].sender).toBeUndefined();
  conversation.attributePrompt("Check the build", sender, "accepted-delivery");
  conversation.push({ op: "add", path: "/messages/1", value: prompt("accepted-delivery") });
  expect(conversation.getMessages()[1].sender).toEqual(sender);
});
