import { expect, test } from "bun:test";
import { serviceAddress } from "./http";

test("service addresses keep their path and reject credentials, queries and fragments", () => {
  expect(serviceAddress("https://relay.example.com")).toBe("https://relay.example.com");
  expect(serviceAddress("https://base.example.com/relay/")).toBe("https://base.example.com/relay");
  expect(serviceAddress("http://127.0.0.1:8080/relay")).toBe("http://127.0.0.1:8080/relay");
  for (const address of [
    "https://user:secret@base.example.com/relay",
    "https://base.example.com/relay?region=eu",
    "https://base.example.com/relay#live",
    "http://base.example.com/relay",
  ])
    expect(() => serviceAddress(address)).toThrow();
});
