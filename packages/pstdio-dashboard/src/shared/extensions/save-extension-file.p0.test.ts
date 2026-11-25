import { expect, test } from "bun:test";
import { saveExtensionFile } from "./save-extension-file";

test("desktop save returns the native terminal outcome and preserves failures", async () => {
  const input = { name: "great-wave.svg", data: new Uint8Array([1, 2]), mimeType: "image/svg+xml" };
  for (const status of ["saved", "cancelled"] as const) {
    const result = await saveExtensionFile(input, {
      saveFile: async (received: unknown) => {
        expect(received).toEqual(input);
        return { status };
      },
    });
    expect(result).toEqual({ status });
  }
  await expect(
    saveExtensionFile(input, {
      saveFile: async () => {
        throw new Error("Disk full");
      },
    }),
  ).rejects.toThrow("Disk full");
});

test("an older desktop cannot silently claim browser initiation as a native save", async () => {
  await expect(saveExtensionFile({ name: "page.svg", data: new Uint8Array() }, {})).rejects.toThrow("Update");
});
