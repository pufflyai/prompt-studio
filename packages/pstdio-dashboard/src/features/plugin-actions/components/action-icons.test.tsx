import { describe, expect, it } from "bun:test";
import { Play } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderHeaderActionIcon, resolveHeaderActionIcon } from "./action-icons";

describe("resolveHeaderActionIcon", () => {
  it("resolves kebab or lowercase lucide icon names", () => {
    expect(resolveHeaderActionIcon("play")).toBe(Play);
  });
});

describe("renderHeaderActionIcon", () => {
  it("renders a lucide svg without requiring a Chakra provider", () => {
    const markup = renderToStaticMarkup(renderHeaderActionIcon("play", 14));

    expect(markup).toContain("lucide-play");
  });
});
