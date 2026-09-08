import { describe, expect, test } from "bun:test";
import type { LandingView } from "./landing-content";
import { ALL_LANDING_PATHS, landingPathForView, landingViewFromPath } from "./landing-route";

const views: LandingView[] = ["start", "why-prompt-studio", "features", "privacy", "terms"];

describe("landing routes", () => {
  test.each(views)("round-trips %s", (view: LandingView) => {
    const path = landingPathForView(view);

    expect(landingViewFromPath(path)).toBe(view);
    expect(ALL_LANDING_PATHS).toContain(path);
  });

  test("normalizes trailing slashes and ignores query strings and hashes", () => {
    expect(landingViewFromPath("/features/?utm=x#top")).toBe("features");
  });

  test("falls back to the start view for an unknown path", () => {
    expect(landingViewFromPath("/does-not-exist")).toBe("start");
  });
});
