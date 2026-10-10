import { describe, expect, test } from "bun:test";
import { coverageBadge, summarizeCoverage } from "./coverage-badge";

const root = "/repo";

const lcov = (...files: Array<[path: string, lines: Array<[line: number, hits: number]>]>) =>
  files
    .flatMap(([path, lines]) => [
      "TN:",
      `SF:${path}`,
      ...lines.map(([line, hits]) => `DA:${line},${hits}`),
      "end_of_record",
    ])
    .join("\n");

describe("summarizeCoverage", () => {
  test("counts a source file once when several packages report it", () => {
    const summary = summarizeCoverage(root, [
      {
        packageDir: "/repo/packages/api",
        content: lcov([
          "../contracts/src/a.ts",
          [
            [1, 1],
            [2, 0],
            [3, 0],
          ],
        ]),
      },
      {
        packageDir: "/repo/packages/sdk",
        content: lcov([
          "../contracts/src/a.ts",
          [
            [1, 0],
            [2, 4],
            [3, 0],
          ],
        ]),
      },
    ]);

    expect(summary).toEqual({ coveredLines: 2, totalLines: 3 });
  });

  test("leaves out tests, fixtures, dependencies, build output, and files outside the repo", () => {
    const summary = summarizeCoverage(root, [
      {
        packageDir: "/repo/packages/api",
        content: lcov(
          [
            "src/app.ts",
            [
              [1, 1],
              [2, 0],
            ],
          ],
          ["src/app.test.ts", [[1, 1]]],
          ["src/button.stories.tsx", [[1, 1]]],
          ["src/test-utils/fake.ts", [[1, 1]]],
          ["src/fixtures/extension.ts", [[1, 1]]],
          ["src/session.test-fixture.ts", [[1, 1]]],
          ["src/control-declaration-fixtures.ts", [[1, 1]]],
          ["src/chat-test-support.ts", [[1, 1]]],
          ["src/mocks/handlers.ts", [[1, 1]]],
          ["src/mock-data.ts", [[1, 1]]],
          ["../../scripts/test-setup.ts", [[1, 1]]],
          ["__test-tmp__/home/extension.ts", [[1, 1]]],
          ["../../node_modules/hono/index.js", [[1, 1]]],
          ["../ui/dist/index.js", [[1, 1]]],
          ["../../../../tmp/cache/extension.ts", [[1, 1]]],
        ),
      },
    ]);

    expect(summary).toEqual({ coveredLines: 1, totalLines: 2 });
  });

  test("checks only the part of the path inside the repo", () => {
    const summary = summarizeCoverage("/home/dist/repo", [
      { packageDir: "/home/dist/repo/packages/api", content: lcov(["src/app.ts", [[1, 1]]]) },
    ]);

    expect(summary).toEqual({ coveredLines: 1, totalLines: 1 });
  });
});

describe("coverageBadge", () => {
  test("describes the rounded line coverage as a shields.io endpoint badge", () => {
    expect(coverageBadge({ coveredLines: 7_917, totalLines: 10_000 })).toEqual({
      schemaVersion: 1,
      label: "coverage",
      message: "79%",
      color: "yellowgreen",
    });
  });

  test("colors the badge by coverage level", () => {
    expect(coverageBadge({ coveredLines: 95, totalLines: 100 }).color).toBe("brightgreen");
    expect(coverageBadge({ coveredLines: 45, totalLines: 100 }).color).toBe("red");
  });

  test("refuses to describe a run that measured no lines", () => {
    expect(() => coverageBadge({ coveredLines: 0, totalLines: 0 })).toThrow("No source lines");
  });
});
