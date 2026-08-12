import { describe, expect, test } from "bun:test";
import { createExtensionInstallEnvironment, createExtensionProcessEnvironment } from "./process-environment";

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

describe("createExtensionInstallEnvironment", () => {
  test("inherits package network configuration without exposing unrelated host secrets", () => {
    const env = createExtensionInstallEnvironment({
      PATH: "/bin",
      HTTPS_PROXY: "https://proxy.example.com",
      http_proxy: "http://proxy.example.com",
      NO_PROXY: "127.0.0.1,localhost",
      BUN_CONFIG_REGISTRY: "https://registry.example.com",
      npm_config_registry: "https://npm.example.com",
      NPM_TOKEN: "registry-secret",
      NODE_EXTRA_CA_CERTS: "/certs/company.pem",
      npm_config_cafile: "/certs/npm.pem",
      SSL_CERT_FILE: "/certs/system.pem",
      PSTDIO_API_TOKEN: "runtime-secret",
      OPENAI_API_KEY: "provider-secret",
      GITHUB_TOKEN: "github-secret",
      NODE_OPTIONS: "--require malicious.js",
    });

    expect(env).toEqual({
      PATH: "/bin",
      HTTPS_PROXY: "https://proxy.example.com",
      http_proxy: "http://proxy.example.com",
      NO_PROXY: "127.0.0.1,localhost",
      BUN_CONFIG_REGISTRY: "https://registry.example.com",
      npm_config_registry: "https://npm.example.com",
      NPM_TOKEN: "registry-secret",
      NODE_EXTRA_CA_CERTS: "/certs/company.pem",
      npm_config_cafile: "/certs/npm.pem",
      SSL_CERT_FILE: "/certs/system.pem",
    });
  });
});
