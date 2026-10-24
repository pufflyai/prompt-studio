import { expect, test } from "bun:test";
import { chooseCompatibleRelease, parseRegistrySourceRef, registrySourceRef } from "./registry";

const release = (version: string, enginesPstdio: string, withdrawn = false) => ({
  id: "pstdio.notes",
  version,
  enginesPstdio,
  withdrawn,
  sha256: "a".repeat(64),
});
test("selects the newest supported release and skips withdrawn releases", () => {
  const releases = [
    release("0.45.1", "^0.2.0"),
    release("0.46.0", "^0.3.0"),
    release("0.45.2", "^0.2.2"),
    release("0.45.3", "^0.2.0", true),
  ];
  expect(chooseCompatibleRelease(releases, "0.2.4")?.version).toBe("0.45.2");
  expect(chooseCompatibleRelease(releases, "0.2.0")?.version).toBe("0.45.1");
  expect(chooseCompatibleRelease(releases, "0.1.0")).toBeNull();
});
test("records a registry identity without losing its base path", () => {
  const source = { registry: "https://base.example/psx", id: "pstdio.notes", version: "0.45.2" };
  expect(parseRegistrySourceRef(registrySourceRef(source))).toEqual(source);
  expect(parseRegistrySourceRef("https://github.com/example/repo@commit#extensions/notes")).toBeNull();
});
