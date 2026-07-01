import { describe, expect, test } from "bun:test";
import { extensionControlsRendererRecordSchema } from "./extensions";

describe("extension controls renderer contracts", () => {
  test("accepts a valid controls renderer record with command ids", () => {
    const record = extensionControlsRendererRecordSchema.parse({
      id: "image-tools.imageInspector",
      extensionId: "acme.image-tools",
      title: "Image controls",
      queryCommandId: "image-tools.loadImageControls",
      updateValueCommandId: "image-tools.updateImageControl",
      resetCommandId: "image-tools.resetImageControls",
      defaultValues: { anchor: "center" },
    });

    expect(record).toMatchObject({
      id: "image-tools.imageInspector",
      queryCommandId: "image-tools.loadImageControls",
      updateValueCommandId: "image-tools.updateImageControl",
    });
  });

  test("rejects a record without a query command", () => {
    const result = extensionControlsRendererRecordSchema.safeParse({
      id: "image-tools.imageInspector",
      extensionId: "acme.image-tools",
      title: "Image controls",
    });

    expect(result.success).toBe(false);
  });
});
