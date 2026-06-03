import { describe, expect, it } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToString } from "react-dom/server";
import { psTheme } from "../theme";
import type { PaletteEntry } from "./palette";
import { PaletteList } from "./palette-list";

const entries: PaletteEntry[] = [
  {
    id: "command:create-ticket",
    label: "Create ticket",
    onActivate: () => undefined,
  },
  {
    id: "command:open-ticket",
    label: "Open ticket",
    onActivate: () => undefined,
  },
];

const renderPaletteList = (activeIndex = 0) =>
  renderToString(
    <ChakraProvider value={psTheme}>
      <PaletteList
        entries={entries}
        activeIndex={activeIndex}
        emptyLabel="No results."
        onHover={() => undefined}
        scrollRef={{ current: null }}
      />
    </ChakraProvider>,
  );

const getRowClass = (html: string, selected: boolean) => {
  const match = html.match(new RegExp(`aria-selected="${selected}" class="group ([^"]+)"`));
  return match?.[1] ?? "";
};

const getHoverRule = (html: string, className: string) => {
  const match = html.match(
    new RegExp(`\\.${className}:is\\(:hover, \\[data-hover\\]\\):not\\(:disabled, \\[data-disabled\\]\\)\\{([^}]*)\\}`),
  );
  return match?.[1] ?? "";
};

describe("PaletteList", () => {
  it("renders initial rows before the scroll viewport ref is connected", () => {
    expect(renderPaletteList()).toContain("Create ticket");
  });

  it("does not paint inactive hovered rows as active", () => {
    const html = renderPaletteList(1);
    const inactiveHoverRule = getHoverRule(html, getRowClass(html, false));
    const activeHoverRule = getHoverRule(html, getRowClass(html, true));

    expect(inactiveHoverRule).toContain("--chakra-colors-transparent");
    expect(inactiveHoverRule).not.toContain("--chakra-colors-bg-menu-item-hover");
    expect(activeHoverRule).toContain("--chakra-colors-bg-menu-item-hover");
  });
});
