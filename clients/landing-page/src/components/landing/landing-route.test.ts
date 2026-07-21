import { describe, expect, test } from "bun:test";
import {
  ALL_LANDING_PATHS,
  type LandingLocation,
  landingLocationFromPath,
  landingPathForLocation,
} from "./landing-route";

const locations: LandingLocation[] = [
  { activeTab: "docs", activeView: "start" },
  { activeTab: "docs", activeView: "gallery" },
  { activeTab: "docs", activeView: "concepts" },
  { activeTab: "docs", activeView: "guide-getting-started" },
  { activeTab: "docs", activeView: "guide-create-ticket" },
  { activeTab: "docs", activeView: "guide-implement-ticket" },
  { activeTab: "docs", activeView: "guide-create-proposal" },
  { activeTab: "docs", activeView: "guide-create-sub-tickets" },
  { activeTab: "docs", activeView: "guide-refine-ticket" },
  { activeTab: "docs", activeView: "guide-create-extension" },
  { activeTab: "docs", activeView: "cli-workspaces" },
  { activeTab: "docs", activeView: "cli-agents" },
  { activeTab: "docs", activeView: "cli-sessions" },
  { activeTab: "docs", activeView: "sdk-commands" },
  { activeTab: "docs", activeView: "blog" },
  { activeTab: "docs", activeView: "blog", blogPostId: "hello-world" },
  { activeTab: "docs", activeView: "privacy" },
  { activeTab: "docs", activeView: "terms" },
  { activeTab: "agentic-kanban", activeView: "start" },
  { activeTab: "agentic-design", activeView: "start" },
  { activeTab: "agentic-data-analysis", activeView: "start" },
  { activeTab: "workflow-builder", activeView: "start" },
];

describe("landing routes", () => {
  test.each(locations)("round-trips $activeTab / $activeView / $blogPostId", (location) => {
    const path = landingPathForLocation(location);

    expect(landingLocationFromPath(path)).toEqual(location);
    expect(ALL_LANDING_PATHS).toContain(path);
  });

  test("normalizes trailing slashes and ignores query strings and hashes", () => {
    expect(landingLocationFromPath("/guides/getting-started/?source=docs#install")).toEqual({
      activeTab: "docs",
      activeView: "guide-getting-started",
    });
  });

  test("gives agents and sessions distinct reference paths", () => {
    expect(landingPathForLocation({ activeTab: "docs", activeView: "cli-agents" })).toBe("/docs/cli/agents");
    expect(landingPathForLocation({ activeTab: "docs", activeView: "cli-sessions" })).toBe("/docs/cli/sessions");
  });

  test("falls back to the start view for an unknown path", () => {
    expect(landingLocationFromPath("/does-not-exist")).toEqual({ activeTab: "docs", activeView: "start" });
  });
});
