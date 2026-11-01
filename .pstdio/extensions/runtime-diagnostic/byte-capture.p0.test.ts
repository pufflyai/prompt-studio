import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureBytes, startByteCapture } from "./byte-capture";

describe("backend byte captures", () => {
  test("cancellation restores Buffer.from and releases capture ownership", async () => {
    const original = Buffer.from;
    const controller = new AbortController();
    const result = captureBytes(10, controller.signal).catch((error: unknown) => error);
    controller.abort();
    const error = await result;

    expect(error).toMatchObject({ name: "AbortError" });
    expect(Buffer.from).toBe(original);
    const next = startByteCapture();
    next();
  });

  test("counts hex decodes and restores the original Buffer.from", () => {
    const original = Buffer.from;
    const finish = startByteCapture();
    try {
      const decoded = Buffer.from("616263", "hex");
      Buffer.from("plain text");
      const result = finish();

      expect(decoded.toString()).toBe("abc");
      expect(result).toMatchObject({ calls: 1, bytes: 3, large: [], sizes: [] });
      expect(Buffer.from).toBe(original);
    } finally {
      finish();
    }
  });

  test("counts actual bytes when hex input is truncated", () => {
    const finish = startByteCapture();
    try {
      Buffer.from("f", "hex");
      Buffer.from("ffgg", "hex");
      Buffer.from("f".repeat(200_001), "hex");
      const result = finish();

      expect(result.calls).toBe(3);
      expect(result.bytes).toBe(100_001);
      expect(result.large).toEqual([]);
      expect(result.sizes).toEqual([]);
    } finally {
      finish();
    }
  });

  test("rejects an overlapping capture without interrupting its owner", () => {
    const original = Buffer.from;
    const finish = startByteCapture();
    let overlapping: ReturnType<typeof startByteCapture> | undefined;
    try {
      expect(() => {
        overlapping = startByteCapture();
      }).toThrow("A backend byte capture is already running");
      Buffer.from("ff", "hex");
      const result = finish();

      expect(result.calls).toBe(1);
      expect(Buffer.from).toBe(original);
    } finally {
      overlapping?.();
      finish();
    }
  });

  test("a completed capture cannot stop the next capture during file persistence", () => {
    const original = Buffer.from;
    const first = startByteCapture();
    first();
    const second = startByteCapture();
    try {
      first();
      Buffer.from("ff", "hex");
      const result = second();

      expect(result.calls).toBe(1);
      expect(Buffer.from).toBe(original);
    } finally {
      second();
    }
  });

  test("separate module instances share ownership across projects and reloads", async () => {
    const directory = mkdtempSync(join(tmpdir(), "byte-capture-reload-"));
    try {
      const copy = join(directory, "byte-capture.ts");
      writeFileSync(copy, readFileSync(new URL("./byte-capture.ts", import.meta.url)));
      const reloaded = await import(copy);
      expect(reloaded.startByteCapture).not.toBe(startByteCapture);
      const original = Buffer.from;
      const first = startByteCapture();
      let overlapping: ReturnType<typeof startByteCapture> | undefined;
      try {
        expect(() => {
          overlapping = reloaded.startByteCapture();
        }).toThrow("A backend byte capture is already running");
        first();
        const next = reloaded.startByteCapture();
        try {
          Buffer.from("ff", "hex");
          expect(next().calls).toBe(1);
          expect(Buffer.from).toBe(original);
        } finally {
          next();
        }
      } finally {
        overlapping?.();
        first();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
