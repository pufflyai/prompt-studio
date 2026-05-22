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
];

const renderPaletteList = () =>
  renderToString(
    <ChakraProvider value={psTheme}>
      <PaletteList
        entries={entries}
        activeIndex={0}
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
