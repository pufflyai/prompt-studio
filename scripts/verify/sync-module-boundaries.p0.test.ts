import { expect, test } from "bun:test";
import { syncModuleViolation } from "./sync-module-boundaries";

const file = (module: string) => `packages/pstdio-sync/src/${module}/example.ts`;

test("text and presence remain independent of record, relay and editor implementations", () => {
  expect(syncModuleViolation(file("text"), "../records")).toContain("must not depend on records");
  expect(syncModuleViolation(file("text"), "../relay")).toContain("must not depend on relay");
  expect(syncModuleViolation(file("presence"), "../text")).toContain("must not depend on text");
  expect(syncModuleViolation(file("text"), "@pstdio/ui")).toContain("must not import");
  expect(syncModuleViolation(file("text"), "pstdio-api-contracts")).toContain("must not import");
});

test("module consumers use the entry point while implementation details stay local", () => {
  expect(syncModuleViolation(file("records"), "../text")).toBeUndefined();
  expect(syncModuleViolation(file("relay"), "../text/text-document-adoption")).toContain("entry point");
  expect(syncModuleViolation(file("text"), "./text-document-adoption")).toBeUndefined();
  expect(syncModuleViolation(file("text"), "../shared")).toBeUndefined();
  expect(syncModuleViolation(file("encryption"), "../shared")).toBeUndefined();
  expect(syncModuleViolation(file("relay"), "../encryption")).toBeUndefined();
});
