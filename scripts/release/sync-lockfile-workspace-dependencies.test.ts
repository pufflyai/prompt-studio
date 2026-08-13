import { expect, test } from "bun:test";
import { syncLockfileWorkspaceDependencies } from "./sync-lockfile-workspace-dependencies";

test("updates dependency ranges only inside their matching lockfile workspace", () => {
  const source = `{
  "workspaces": {
    "extensions/example": {
      "dependencies": {
        "@pstdio/sdk": "^0.16.0",
      },
    },
    "packages/unchanged": {
      "dependencies": {
        "@pstdio/sdk": "^0.16.0",
      },
    },
  },
}`;

  expect(
    syncLockfileWorkspaceDependencies(source, {
      "extensions/example": { dependencies: { "@pstdio/sdk": "^0.17.0" } },
      "packages/unchanged": { dependencies: { "@pstdio/sdk": "^0.16.0" } },
    }),
  ).toBe(`{
  "workspaces": {
    "extensions/example": {
      "dependencies": {
        "@pstdio/sdk": "^0.17.0",
      },
    },
    "packages/unchanged": {
      "dependencies": {
        "@pstdio/sdk": "^0.16.0",
      },
    },
  },
}`);
});

test("updates the matching dependency field when a package appears more than once", () => {
  const source = `{
  "workspaces": {
    "packages/example": {
      "dependencies": {
        "shared": "1.0.0",
      },
      "peerDependencies": {
        "shared": "1.0.0",
      },
    },
  },
}`;

  expect(
    syncLockfileWorkspaceDependencies(source, {
      "packages/example": {
        dependencies: { shared: "2.0.0" },
        peerDependencies: { shared: "^2.0.0" },
      },
    }),
  ).toContain(`"dependencies": {
        "shared": "2.0.0",
      },
      "peerDependencies": {
        "shared": "^2.0.0"`);
});
