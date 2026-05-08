import { describe, expect, test } from "bun:test";
import { loadEmbedConfig } from "./embed-manifest";

describe("embed manifest", () => {
  test("does not package internal skills or templates", () => {
    const config = loadEmbedConfig();
    const internalCatalogFiles = config.files.filter(
      (file) => file.includes("/files/templates/") || file.includes("/files/skills/"),
    );

    expect(internalCatalogFiles).toEqual([]);
  });
});
