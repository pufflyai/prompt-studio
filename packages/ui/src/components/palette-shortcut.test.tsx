import { describe, expect, it } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToString } from "react-dom/server";
import { psTheme } from "../theme";
import { PaletteShortcut, resolveShortcutDisplayPart } from "./palette-shortcut";

const renderShortcut = (binding: string | string[]) =>
  renderToString(
    <ChakraProvider value={psTheme}>
      <PaletteShortcut binding={binding} />
    </ChakraProvider>,
  );

describe("PaletteShortcut", () => {
  it("resolves user-facing modifier labels for non-mac platforms", () => {
    const html = renderShortcut("mod+alt+k");

    expect(html).not.toContain(" + ");
    expect(html).not.toContain(">mod<");
    expect(html).not.toContain(">alt<");
    expect(resolveShortcutDisplayPart("mod", "linux")).toMatchObject({ label: "Ctrl" });
    expect(resolveShortcutDisplayPart("alt", "linux")).toMatchObject({ label: "Alt" });
  });

  it("resolves mac modifiers to icon-backed labels", () => {
    expect(resolveShortcutDisplayPart("mod", "mac")).toMatchObject({ label: "Command" });
    expect(resolveShortcutDisplayPart("alt", "mac")).toMatchObject({ label: "Option" });
    expect(resolveShortcutDisplayPart("mod", "mac").Icon).toBeDefined();
    expect(resolveShortcutDisplayPart("alt", "mac").Icon).toBeDefined();
  });

  it("renders arrow keys as icon-backed labels", () => {
    const html = renderShortcut("mod+arrowleft+arrowright");

    expect(html).not.toContain(">arrowleft<");
    expect(html).not.toContain(">arrowright<");
    expect(html).toContain('aria-label="Arrow Left"');
    expect(html).toContain('aria-label="Arrow Right"');
  });
});
