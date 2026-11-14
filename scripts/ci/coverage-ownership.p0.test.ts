import { expect, test } from "bun:test";
import { integrationCoverage, selectIntegrationFiles } from "./coverage-ownership";

const desktop = (name: string) => `clients/desktop/src/e2e/${name}`;
const cli = (name: string) => `packages/e2e/src/packaged/${name}`;
test("shared flows have one Linux owner; actual native boundaries retain their hosts", () => {
  const files = [
    desktop("packaged-navigation-customization.p2.spec.ts"),
    desktop("packaged-folder-picker.p2.spec.ts"),
    desktop("packaged-app.p1.spec.ts"),
  ];
  expect(selectIntegrationFiles(files, { platform: "darwin", arch: "arm64" })).toEqual([files[2]!]);
  expect(selectIntegrationFiles(files, { platform: "win32", arch: "x64" })).toEqual(files.slice(1));
  expect(integrationCoverage(files[1]!).reason).toContain("drive");
  expect(integrationCoverage(files[0]!).surface).toBe("shared-desktop");
});

test("secondary CLI targets prove native artifacts without replaying Planner journeys", () => {
  const files = [
    cli("packaged-planner-smoke.p2.test.ts"),
    cli("packaged-native-terminal.p1.test.ts"),
    cli("npm-entrypoint.p1.test.ts"),
  ];
  expect(selectIntegrationFiles(files, { platform: "win32", arch: "arm64" })).toEqual(files.slice(1));
  expect(selectIntegrationFiles(files, { platform: "linux", arch: "x64" })).toEqual(files);
});

test("mixed watcher and terminal-interruption cases keep native primary hosts", () => {
  const files = [cli("packaged-artifact-watch-limit.p2.test.ts"), cli("extension-smoke.p2.test.ts")];
  for (const platform of ["darwin", "win32"])
    expect(selectIntegrationFiles(files, { platform, arch: platform === "darwin" ? "arm64" : "x64" })).toEqual(files);
});

test("smoke is mandatory and fixture edits select their consuming desktop flows", () => {
  const smoke = desktop("packaged-app.p1.spec.ts");
  const navigation = desktop("packaged-navigation-customization.p2.spec.ts");
  const files = [smoke, navigation];
  expect(selectIntegrationFiles(files, { platform: "linux", arch: "x64" }, { changed: [], owners: [] })).toEqual([
    smoke,
  ]);
  expect(
    selectIntegrationFiles(
      files,
      { platform: "linux", arch: "x64" },
      { changed: ["clients/desktop/src/e2e/packaged-project-helpers.ts"], owners: [] },
    ),
  ).toEqual(files);
});

test("Planner ownership does not match the board substring in onboarding", () => {
  const files = [cli("packaged-planner-smoke.p2.test.ts"), cli("packaged-cloud-notes-onboarding.p2.test.ts")];
  expect(
    selectIntegrationFiles(files, { platform: "linux", arch: "x64" }, { changed: [], owners: ["pstdio-planner"] }),
  ).toEqual([files[0]!]);
});
