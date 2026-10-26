import { expect, test } from "bun:test";
import { windowsPackageVersion } from "./package-layout";

// NuGet 2 packs Squirrel installers and accepts only SemVer 1 versions. The prerelease
// part must start with a letter, contain no dots and have at most 20 characters.
const nugetSemver1 = /^\d+\.\d+\.\d+(-[A-Za-z][0-9A-Za-z-]{0,19})?$/;

test("Windows installers accept nightly versions", () => {
  const version = windowsPackageVersion("0.46.0-nightly.20261026030503");

  expect(version).toMatch(nugetSemver1);
  expect(version.startsWith("0.46.0-nightly")).toBe(true);
});

test("later nightlies keep a higher Windows package version", () => {
  const earlier = windowsPackageVersion("0.46.0-nightly.20261025065455");
  const later = windowsPackageVersion("0.46.0-nightly.20261026030503");

  // NuGet SemVer 1 compares prerelease parts as text.
  expect(later > earlier).toBe(true);
});

test("Windows installers keep stable versions unchanged", () => {
  expect(windowsPackageVersion("0.46.0")).toBe("0.46.0");
});
