import { describe, expect, test } from "bun:test";
import { resolveOpenVersion } from "./navigation";

const lab = [
  { id: "section-hatch", versions: [{ id: "default" }, { id: "soft" }] },
  { id: "dots-to-grid", versions: [{ id: "default" }] },
];

describe("open version", () => {
  test("opens the requested version", () => {
    expect(resolveOpenVersion(lab, "section-hatch/soft")).toEqual({ shader: "section-hatch", version: "soft" });
  });

  test("falls back to the first version when the requested one was deleted or none is requested", () => {
    expect(resolveOpenVersion(lab, "section-hatch/gone")).toEqual({ shader: "section-hatch", version: "default" });
    expect(resolveOpenVersion(lab)).toEqual({ shader: "section-hatch", version: "default" });
  });

  test("an empty lab has nothing to open", () => {
    expect(resolveOpenVersion([], "section-hatch/default")).toBeNull();
  });
});
