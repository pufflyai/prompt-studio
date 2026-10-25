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

describe("PaletteList", () => {
  it("renders initial rows before the scroll viewport ref is connected", () => {
    expect(renderPaletteList()).toContain("Create ticket");
  });
});
