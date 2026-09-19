import { describe, expect, test } from "bun:test";
import { l10n } from "pstdio-api-contracts/extension-kernel";
import { createLocalizationCollector } from "./localizable";

describe("stable contribution translation keys", () => {
  test("escapes declared segments and keeps explicit shared tokens", () => {
    const collector = createLocalizationCollector();
    expect(collector.value("Theme", ["settings", "properties", "editor/theme~name", "title"])).toEqual({
      $l10n: "contributions/settings/properties/editor~1theme~0name/title",
      default: "Theme",
    });
    expect(collector.value(l10n("shared.title", "Shared"), ["pages", "home", "title"])).toEqual(
      l10n("shared.title", "Shared"),
    );
    expect(collector.defaults["shared.title"]).toBe("Shared");
  });

  test("diagnoses reserved explicit keys and conflicting automatic defaults", () => {
    const collector = createLocalizationCollector();
    collector.value("First", ["pages", "home", "title"]);
    collector.value("Second", ["pages", "home", "title"]);
    collector.value(l10n("contributions/commands/create/title", "Create"));
    expect(collector.diagnostics.map((item) => item.code)).toEqual([
      "conflicting_automatic_translation_key",
      "reserved_translation_key",
    ]);
  });

  test("does not derive keys without a stable path", () => {
    const collector = createLocalizationCollector();
    expect(collector.value("Menu label")).toBe("Menu label");
    expect(collector.value(l10n("menu.label", "Menu label"))).toEqual(l10n("menu.label", "Menu label"));
    expect([...collector.keys]).toEqual(["menu.label"]);
  });
});

test("keyed metadata is stable under reorder and unkeyed options stay explicit", () => {
  const normalize = (ids: string[]) => {
    const collector = createLocalizationCollector();
    const [view] = collector.contributions("views", [
      {
        id: "board",
        title: "Board",
        body: {
          kind: "kanban",
          rowActions: ids.map((id) => ({ id, label: id })),
          attributes: [
            {
              id: "status",
              label: "Status",
              type: {
                kind: "enum",
                options: [
                  { value: "one", label: "One" },
                  { value: "two", label: l10n("status.two", "Two") },
                ],
              },
            },
          ],
        },
      },
    ]);
    return { view, collector };
  };
  const first = normalize(["a/b~c", "second"]);
  const reordered = normalize(["second", "a/b~c"]);
  expect(first.collector.defaults).toEqual(reordered.collector.defaults);
  expect(first.collector.defaults["contributions/views/board/body/rowActions/a~1b~0c/label"]).toBe("a/b~c");
  expect(first.view.body.attributes[0].type.options[0].label).toBe("One");
  expect(first.collector.defaults["status.two"]).toBe("Two");
});
