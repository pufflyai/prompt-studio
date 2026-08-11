import { describe, expect, test } from "bun:test";
import { createExtensionProcessEnvironment } from "./process-environment";

describe("createExtensionProcessEnvironment", () => {
  test("inherits only runtime-safe host variables and explicit overrides", () => {
    const env = createExtensionProcessEnvironment(
      {
        BUN_INSTALL: "/opt/bun",
        PATH: "/bin",
        HOME: "/home/tester",
        LANG: "en_US.UTF-8",
        LC_ALL: "en_US.UTF-8",
        LOGNAME: "tester",
        USER: "tester",
        VOLTA_HOME: "/opt/volta",
        PSTDIO_API_TOKEN: "runtime-secret",
        OPENAI_API_KEY: "provider-secret",
        GITHUB_TOKEN: "github-secret",
        NODE_OPTIONS: "--require malicious.js",
        SSH_AUTH_SOCK: "/tmp/agent.sock",
      },
      { PSTDIO_SESSION_ID: "session-one", CUSTOM_VALUE: "explicit" },
    );

    expect(env).toEqual({
      BUN_INSTALL: "/opt/bun",
      PATH: "/bin",
      HOME: "/home/tester",
      LANG: "en_US.UTF-8",
      LC_ALL: "en_US.UTF-8",
      LOGNAME: "tester",
      USER: "tester",
      VOLTA_HOME: "/opt/volta",
      PSTDIO_SESSION_ID: "session-one",
      CUSTOM_VALUE: "explicit",
    });
  });
});
