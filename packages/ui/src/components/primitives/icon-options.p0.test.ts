import { expect, test } from "bun:test";
import { Circle, Monitor } from "lucide-react";
import { getIconComponent } from "./icon-options";

test("group icons resolve known devices and fall back for inherited property names", () => {
  expect(getIconComponent("monitor")).toBe(Monitor);
  expect(getIconComponent("__proto__")).toBe(Circle);
  expect(getIconComponent("constructor")).toBe(Circle);
});
