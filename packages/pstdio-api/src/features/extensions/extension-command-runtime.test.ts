import { describe, expect, test } from "bun:test";
import { createCommandEnvironment } from "./extension-command-runtime";

describe("createCommandEnvironment", () => {
  test("finds enabled sources by extension id when stored namespace is stale", () => {
    const enabledSources = [
      {
        instance: {
          id: "instance-1",
          namespace: "lab",
        },
        installedSource: {
          id: "source-1",
          extension_id: "pstdio.extension-lab",
        },
      },
    ];

    expect(() =>
      createCommandEnvironment({} as never, enabledSources as never, {
        extensionId: "pstdio.extension-lab",
        name: "extension-lab",
        projectId: "project-1",
      }),
    ).not.toThrow();
  });
});
