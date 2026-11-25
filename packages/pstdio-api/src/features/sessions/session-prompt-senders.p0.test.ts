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

test.each(["add", "replace"] as const)("an inserted prompt keeps its own sender in a %s patch", (op) => {
  const old = { ...prompt("old"), sender };
  const incoming = prompt("inserted");
  const delivered = prompt("delivery");
  const newSender = { type: "user" as const, id: "new-user", name: "New user" };
  const conversation = createSessionConversation(createEventStore(), [old]);
  conversation.attributePrompt("Check the build", newSender, delivered.id);
  if (op === "add") {
    conversation.push({ op, path: "/messages/0", value: incoming });
    conversation.push({ op, path: "/messages/1", value: delivered });
  } else {
    conversation.push({ op, path: "/messages", value: [incoming, delivered, prompt(old.id)] });
  }
  expect(conversation.getMessages()).toEqual([incoming, { ...delivered, sender: newSender }, old]);
});

test("only the exact submitted text or a generated attachment manifest establishes a fresh sender", () => {
  const text = "Review this example:\n\n<session-attachments>\nliteral content\n</session-attachments>";
  const manifest =
    '\n\n<session-attachments>\n- name="notes.md" path="/notes.md" mime=null size=10\n</session-attachments>';
  const conversation = createSessionConversation(createEventStore());
  conversation.attributePrompt(text, sender);
  conversation.push({ op: "add", path: "/messages/0", value: prompt("example", text) });
  expect(conversation.getMessages()[0]).toEqual({ ...prompt("example", text), sender });

  conversation.attributePrompt(text, sender);
  conversation.push({ op: "add", path: "/messages/1", value: prompt("attached", text + manifest) });
  expect(conversation.getMessages()[1].sender).toEqual(sender);

  const other = createSessionConversation(createEventStore());
  other.attributePrompt("Review this example:", sender);
  other.push({ op: "add", path: "/messages/0", value: prompt("unrelated", text) });
  expect(other.getMessages()[0].sender).toBeUndefined();
});
