import { expect, test } from "bun:test";
import { updateWindowsPath } from "./windows-path";

const directory = "C:\\Users\\Person\\AppData\\Local\\PromptStudio\\bin";

test("adds the desktop command after existing Windows PATH entries", () => {
  const existing = "%USERPROFILE%\\bin;C:\\Other CLI;;";
  expect(updateWindowsPath(existing, directory, "install")).toBe(`${existing};${directory}`);
  expect(updateWindowsPath(updateWindowsPath(existing, directory, "install"), directory, "uninstall")).toBe(existing);
  expect(updateWindowsPath("", directory, "install")).toBe(directory);
});

test("keeps an existing Windows PATH entry without adding duplicates", () => {
  const existing = `C:\\Tools;"${directory.toUpperCase()}\\";C:\\Other`;
  expect(updateWindowsPath(existing, directory, "install")).toBe(existing);
});

test("removes only the desktop command directory from Windows PATH", () => {
  const existing = `C:\\Tools;${directory};%USERPROFILE%\\bin;${directory}\\other`;
  expect(updateWindowsPath(existing, directory, "uninstall")).toBe(`C:\\Tools;%USERPROFILE%\\bin;${directory}\\other`);
  expect(updateWindowsPath("C:\\Tools", directory, "uninstall")).toBe("C:\\Tools");
});
