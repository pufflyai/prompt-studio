import { describe, expect, it } from "bun:test";
import { handleProjectMenuSelectProjects } from "./project-menu";

describe("ProjectMenu", () => {
  it("falls back to the projects route when the picker provider is unavailable", () => {
    const navigateCalls: unknown[] = [];

    handleProjectMenuSelectProjects({
      projectPicker: null,
      navigate: (input) => navigateCalls.push(input),
    });

    expect(navigateCalls).toEqual([{ to: "/projects" }]);
  });

  it("opens the project picker when the provider is available", () => {
    let openCount = 0;
    const navigateCalls: unknown[] = [];

    handleProjectMenuSelectProjects({
      projectPicker: {
        open: () => {
          openCount += 1;
        },
      },
      navigate: (input) => navigateCalls.push(input),
    });

    expect(openCount).toBe(1);
    expect(navigateCalls).toEqual([]);
  });
});
