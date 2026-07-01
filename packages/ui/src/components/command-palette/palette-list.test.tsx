import { describe, expect, it } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToString } from "react-dom/server";
import type { PaletteEntry } from "@/components/command-palette/palette";
import { PaletteList } from "@/components/command-palette/palette-list";
import { psTheme } from "@/theme";

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

    expect(inactiveHoverRule).toContain("--chakra-colors-bg-hover");
    expect(inactiveHoverRule).not.toContain("--chakra-colors-bg-active");
    expect(activeHoverRule).toContain("--chakra-colors-bg-active");
  });
});
