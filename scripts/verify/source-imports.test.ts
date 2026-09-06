import { expect, test } from "bun:test";
import { sourceImports } from "./source-imports";

test("package boundaries inspect real imports and ignore generated extension source strings", () => {
  const code = [
    'import type { Ref } from "types";',
    'import "side-effects";',
    'export { value } from "exported";',
    'const loaded = import("dynamic");',
    'const fixture = `import { definePage } from "@pstdio/sdk/extensions";`;',
    '// import { comment } from "comment";',
  ].join("\n");
  expect(sourceImports(code)).toEqual(["types", "side-effects", "exported", "dynamic"]);
});
