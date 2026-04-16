import { describe, expect, it } from "bun:test";
import { getPluginActionToastPayload } from "./use-plugin-action-trigger";

describe("getPluginActionToastPayload", () => {
  it("returns a success toast payload when action succeeds with message", () => {
    const result = getPluginActionToastPayload("Run project", {
      status: "success",
      message: "Project is starting.",
    });

    expect(result).toEqual({
      type: "success",
      title: "Run project",
      description: "Project is starting.",
    });
  });
});
