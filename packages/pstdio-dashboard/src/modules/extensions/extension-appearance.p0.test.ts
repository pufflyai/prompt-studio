import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { registerExtensionAppearance } from "./extension-appearance";

test("a changed icon font does not replace the unchanged color catalog", () => {
  const core = createWorkbench();
  const appearance = {
    themes: [
      {
        id: "ink",
        title: "Ink",
        mode: "dark" as const,
        tokens: {},
        monacoTheme: { base: "vs-dark" as const, inherit: true as const, rules: [], colors: {} },
      },
    ],
    fileIconThemes: [
      {
        id: "icons",
        title: "Icons",
        definitions: {},
        fileExtensions: {},
        fileNames: {},
        defaults: {},
        fonts: [{ fontFamily: "icons", src: [{ url: "file:///project-a/icons.woff2" }] }],
      },
    ],
  };
  const registration = registerExtensionAppearance(core, appearance);
  const colors = core.themes.listThemes();
  registration.update({
    ...appearance,
    fileIconThemes: appearance.fileIconThemes.map((theme) => ({
      ...theme,
      fonts: [{ fontFamily: "icons", src: [{ url: "file:///project-b/icons.woff2" }] }],
    })),
  });
  expect(core.themes.listThemes()).toBe(colors);
  expect(core.fileIconThemes.listThemes()[0]?.fonts[0]?.src[0]?.url).toBe("file:///project-b/icons.woff2");
  registration.dispose();
  expect(core.themes.listThemes()).toEqual([]);
  expect(core.fileIconThemes.listThemes()).toEqual([]);
});
