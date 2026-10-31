import { expect, test } from "bun:test";
import { Palette } from "lucide-react";
import { resolveIconComponent } from "./resolve-icon-component";

test("preserves exported icon aliases", () => {
  expect(resolveIconComponent("PaletteIcon")).toBe(Palette);
});

test("resolves shared icon names without accepting library helper exports", () => {
  expect(resolveIconComponent("palette")).toBe(Palette);
  expect(resolveIconComponent("icons")).toBeUndefined();
  expect(resolveIconComponent("createLucideIcon")).toBeUndefined();
  expect(resolveIconComponent("unknown-extension-icon")).toBeUndefined();
});
