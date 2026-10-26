import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopUpdateReceipt } from "./desktop-update-receipt";

const roots: string[] = [];
const receiptPath = () => {
  const root = mkdtempSync(join(tmpdir(), "desktop-update-receipt-"));
  roots.push(root);
  return join(root, "downloaded-update-version");
};
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

test("reports a downloaded version as installed once across launches", () => {
  const path = receiptPath();
  new DesktopUpdateReceipt(path).recordDownload("0.33.3");
  expect(new DesktopUpdateReceipt(path).consumeInstalled("0.33.3")).toBe(true);
  expect(new DesktopUpdateReceipt(path).consumeInstalled("0.33.3")).toBe(false);
  expect(existsSync(path)).toBe(false);
});

test("does not claim installation on first launch or while the old version still runs", () => {
  const path = receiptPath();
  const receipt = new DesktopUpdateReceipt(path);
  expect(receipt.consumeInstalled("0.33.2")).toBe(false);
  receipt.recordDownload("0.33.3");
  expect(new DesktopUpdateReceipt(path).consumeInstalled("0.33.2")).toBe(false);
  expect(new DesktopUpdateReceipt(path).consumeInstalled("0.33.3")).toBe(true);
});

test("clears a receipt superseded by a later installed version without claiming it was installed", () => {
  const path = receiptPath();
  new DesktopUpdateReceipt(path).recordDownload("0.33.3");
  expect(existsSync(path)).toBe(true);
  expect(new DesktopUpdateReceipt(path).consumeInstalled("0.34.0")).toBe(false);
  expect(existsSync(path)).toBe(false);
});
