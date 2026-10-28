import { expect, test } from "bun:test";
import { windowsPackageVersion } from "./package-layout";

// NuGet 2 packs Squirrel installers and accepts only SemVer 1 versions. The prerelease
// part must start with a letter, contain no dots and have at most 20 characters.
const nugetSemver1 = /^\d+\.\d+\.\d+(-[A-Za-z][0-9A-Za-z-]{0,19})?$/;

// Squirrel's NuGet fork orders RELEASES entries with this prerelease comparison
// (Squirrel/NuGet `SemanticVersion.CompareTo`). A shared label followed by trailing
// digits is compared as a .NET Int32, which overflows above 2147483647.
const squirrelPrereleaseCompare = (left: string, right: string) => {
  const labelNumber = /([a-z]+)([0-9]+)$/i;
  const a = left.match(labelNumber);
  const b = right.match(labelNumber);
  if (a && b && a[1]!.toLowerCase() === b[1]!.toLowerCase()) {
    const [x, y] = [Number(a[2]), Number(b[2])];
    if (x > 2 ** 31 - 1 || y > 2 ** 31 - 1) throw new Error("Value was either too large or too small for an Int32.");
    return Math.sign(x - y);
  }
  const [x, y] = [left.toUpperCase(), right.toUpperCase()];
  if (x === y) return 0;
  return x > y ? 1 : -1;
};
const prerelease = (version: string) => version.slice(version.indexOf("-") + 1);

test("Windows installers accept nightly versions", () => {
  const version = windowsPackageVersion("0.46.0-nightly.20261026030503");

  expect(version).toMatch(nugetSemver1);
  expect(version.startsWith("0.46.0-nightly")).toBe(true);
});

test("Squirrel orders later nightlies after earlier ones", () => {
  const earlier = prerelease(windowsPackageVersion("0.46.0-nightly.20261026030503"));
  const later = prerelease(windowsPackageVersion("0.46.0-nightly.20261027030305"));

  expect(squirrelPrereleaseCompare(later, earlier)).toBe(1);
  expect(squirrelPrereleaseCompare(later, later)).toBe(0);
});

test("Windows installers keep stable versions unchanged", () => {
  expect(windowsPackageVersion("0.46.0")).toBe("0.46.0");
});
