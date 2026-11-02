import { expect, test } from "bun:test";
import { File } from "node:buffer";
import { extensionIconAssetName } from "pstdio-extensions";
import { resolveCatalogIcon } from "./catalog-icon";
import { packagedExtensionCatalog } from "./extension-catalog";

test("projects bundled catalog SVG bytes without exposing a filesystem path", async () => {
  const entry = { ...packagedExtensionCatalog.extensions[0], icon: "./assets/logo.svg" };
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>';
  const file = new File([svg], `extension-sources/icons/${extensionIconAssetName(entry)}`);
  const value = await resolveCatalogIcon(entry, [file]);
  expect(value).toBe(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
  expect(await resolveCatalogIcon({ ...entry, icon: "tool-case" }, [])).toBe("tool-case");
});

test("does not use a bundled icon for an operator catalog package with the same install name", async () => {
  const stock = packagedExtensionCatalog.extensions[0];
  const entry = {
    ...stock,
    icon: "./assets/logo.svg",
    origin: { ...stock.origin, url: "https://example.com/operator.git" },
  };
  const file = new File(
    ["<svg/>"],
    `extension-sources/icons/${extensionIconAssetName({ ...stock, icon: "./assets/logo.svg" })}`,
  );
  expect(await resolveCatalogIcon(entry, [file])).toBeUndefined();
});

test("does not reuse a bundled asset for a different SVG declaration on the same package", async () => {
  const stock = { ...packagedExtensionCatalog.extensions[0], icon: "./assets/logo.svg" };
  const file = new File(["<svg/>"], `extension-sources/icons/${extensionIconAssetName(stock)}`);
  expect(await resolveCatalogIcon({ ...stock, icon: "./assets/other.svg" }, [file])).toBeUndefined();
});
