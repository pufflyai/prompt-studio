import { describe, expect, test } from "bun:test";
import { extensionRendererContextSchema } from "./extensions";

describe("extension renderer context contracts", () => {
  test("accepts shared renderer context for native renderer callbacks", () => {
    const context = extensionRendererContextSchema.parse({
      rendererId: "lab.files",
      projectId: "project-1",
      modeId: "pstdio.lab.review",
      resource: { type: "ticket", id: "PS-1", label: "Ticket" },
      invocation: { placement: "visible" },
    });

    expect(context).toMatchObject({
      rendererId: "lab.files",
      resource: { type: "ticket", id: "PS-1" },
      invocation: { placement: "visible" },
    });
  });
});
