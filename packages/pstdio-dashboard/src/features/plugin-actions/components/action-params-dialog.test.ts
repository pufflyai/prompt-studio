import { describe, expect, it } from "bun:test";
import { isActionParamValueFilled } from "./action-params-dialog";

describe("isActionParamValueFilled", () => {
  it("requires the selected agent id for agent params", () => {
    expect(
      isActionParamValueFilled({ key: "agent", label: "Agent", type: "agent" }, { agent: "", model: "fake" }),
    ).toBe(false);

    expect(
      isActionParamValueFilled({ key: "agent", label: "Agent", type: "agent" }, { agent: "fake", model: "fake" }),
    ).toBe(true);
  });

  it("requires the selected repo id for repo params", () => {
    expect(
      isActionParamValueFilled({ key: "repo", label: "Repository", type: "repo" }, { repo: "", branch: "main" }),
    ).toBe(false);

    expect(
      isActionParamValueFilled({ key: "repo", label: "Repository", type: "repo" }, { repo: "repo-1", branch: "" }),
    ).toBe(true);
  });
});
