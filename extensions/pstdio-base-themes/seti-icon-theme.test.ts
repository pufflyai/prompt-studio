import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const themePath = join(dirname(fileURLToPath(import.meta.url)), "icons/seti-icon-theme.json");
const theme = JSON.parse(readFileSync(themePath, "utf8")) as {
  iconDefinitions: Record<string, { fontCharacter: string; fontColor?: string }>;
  fileExtensions: Record<string, string>;
};

describe("seti file icon theme", () => {
  test("maps image files to the image glyph", () => {
    expect(theme.iconDefinitions._image?.fontCharacter).toBe("\\E04C");

    for (const extension of ["avif", "bmp", "gif", "heic", "ico", "jpeg", "jpg", "png", "tif", "tiff", "webp"]) {
      expect(theme.fileExtensions[extension]).toBe("_image");
    }
  });
});
