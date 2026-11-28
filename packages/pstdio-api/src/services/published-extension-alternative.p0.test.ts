import { expect, test } from "bun:test";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { packagedExtensionCatalog } from "../features/extensions/extension-catalog";
import { createPublishedExtensionAlternative } from "./published-extension-alternative";

test("reviews an incompatible workspace catalog copy against the running checkout", async () => {
  const alternative = createPublishedExtensionAlternative(Promise.resolve(packagedExtensionCatalog), {
    source: "workspace",
    root: "/workspace/repo",
    ref: "pstdio@0.48.0",
  });
  const input = await alternative.input("pstdio.harness-codex", {
    install_name: "harness-codex",
    manifest_json: { name: "harness-codex", enginesPstdio: "^0.4.0 || ^0.5.0" },
  });
  expect(input.source).toBe(join("/workspace/repo", "extensions/harness-codex"));
  expect(input.skipInstall).toBe(true);
});

test("keeps a compatible local copy's published alternative on its release", async () => {
  const alternative = createPublishedExtensionAlternative(Promise.resolve(packagedExtensionCatalog), {
    source: "workspace",
    root: "/workspace/repo",
    ref: "pstdio@0.48.0",
  });
  const input = await alternative.input("pstdio.harness-codex", {
    install_name: "harness-codex",
    manifest_json: { name: "harness-codex", enginesPstdio: `^${EXTENSION_API_VERSION}` },
  });
  expect(input.source).toBe("harness-codex");
  expect(input.ref).toBe("pstdio@0.48.0");
});
