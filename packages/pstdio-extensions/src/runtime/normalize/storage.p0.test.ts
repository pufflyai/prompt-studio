import { expect, test } from "bun:test";
import { normalizeStorageDeclaration } from "./storage";

test("storage declarations normalize plain log names and preserve only explicit text fields", () => {
  expect(
    normalizeStorageDeclaration({
      records: { text: [{ prefix: "card:", fields: ["/description"] }] },
      logs: ["comments", { name: "runs", writer: "device", keep: { days: 30 } }],
    }),
  ).toEqual({
    records: { text: [{ prefix: "card:", fields: ["/description"] }] },
    logs: [
      { name: "comments", writer: "project" },
      { name: "runs", writer: "device", keep: { days: 30 } },
    ],
  });
});
test("storage declarations reject duplicate logs, invalid retention and implicit text declarations", () => {
  for (const input of [
    { logs: ["runs", { name: "runs" }] },
    { logs: [{ name: "runs", keep: { days: 0 } }] },
    { records: { text: [{ prefix: "card:", fields: ["description"] }] } },
    { records: { multiline: true } },
  ])
    expect(() => normalizeStorageDeclaration(input)).toThrow();
});
