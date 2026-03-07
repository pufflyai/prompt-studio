import { describe, expect, test } from "bun:test";
import { createSeoMetadata } from "./seo-metadata";

describe("createSeoMetadata", () => {
  test("uses defaults when no overrides are provided", () => {
    const seo = createSeoMetadata();

    expect(seo.title).toBe("Prompt Studio — Task Manager for AI Coding Agents");
    expect(seo.url).toBe("https://prompt.studio");
    expect(seo.banner).toBe("https://prompt.studio/images/banner.png");
  });

  test("applies overrides", () => {
    const seo = createSeoMetadata({
      title: "Custom title",
      description: "Custom description",
      banner: "/custom.png",
      pathname: "/docs",
    });

    expect(seo.title).toBe("Custom title");
    expect(seo.description).toBe("Custom description");
    expect(seo.url).toBe("https://prompt.studio/docs");
    expect(seo.banner).toBe("https://prompt.studio/custom.png");
  });
});
