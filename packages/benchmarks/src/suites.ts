import { join } from "node:path";
import { scenarios } from "./catalog/scenarios";
import type { BenchmarkSuite, SuiteContext } from "./suite-types";

export type { BenchmarkSuite, SuiteContext, SuiteStep } from "./suite-types";

const layout = (context: SuiteContext) => {
  const mac = context.platform.startsWith("darwin-");
  const windows = context.platform.startsWith("win32-");
  const name = context.platform.startsWith("linux-") ? "prompt-studio" : "Prompt Studio";
  const root = join(context.root, "clients/desktop/out", `${name}-${context.platform}`);
  const contents = mac ? join(root, `${name}.app`, "Contents") : root;
  return {
    PSTDIO_DESKTOP_EXECUTABLE: mac ? join(contents, "MacOS", name) : join(root, `${name}${windows ? ".exe" : ""}`),
    E2E_PACKAGED_BINARY_PATH: join(contents, mac ? "Resources" : "resources", "bin", windows ? "pstdio.exe" : "pstdio"),
  };
};

// Exactly one entry point per scenario. Phases are metrics, never extra cases or matrices.
export const suites: BenchmarkSuite[] = scenarios.map((scenario) => ({
  id: scenario.id,
  label: scenario.label,
  files: [scenario.file],
  platforms: [...scenario.platforms],
  prepare: (context) =>
    scenario.id === "B7"
      ? []
      : [
          { command: ["bun", "run", "build", "--", "--scope", "@pstdio/desktop", "--include-dependencies"] },
          ...(scenario.id === "B6"
            ? [{ command: ["bunx", "playwright", "install", "chromium"], cwd: "packages/e2e" }]
            : [
                {
                  command: ["bun", "run", "package", "--", `--arch=${context.platform.split("-")[1]}`],
                  cwd: "clients/desktop",
                },
                ...(context.platform.startsWith("linux-")
                  ? [
                      {
                        command: [
                          "sudo",
                          "chown",
                          "root:root",
                          join(
                            context.root,
                            "clients/desktop/out",
                            `prompt-studio-${context.platform}`,
                            "chrome-sandbox",
                          ),
                        ],
                      },
                      {
                        command: [
                          "sudo",
                          "chmod",
                          "4755",
                          join(
                            context.root,
                            "clients/desktop/out",
                            `prompt-studio-${context.platform}`,
                            "chrome-sandbox",
                          ),
                        ],
                      },
                    ]
                  : []),
              ]),
        ],
  sample: (context) => [
    {
      command: [
        ...(context.platform.startsWith("linux-") && !["B6", "B7"].includes(scenario.id) && !process.env.DISPLAY
          ? ["xvfb-run", "-a"]
          : []),
        "bun",
        "--conditions=source",
        scenario.file,
      ],
      env: {
        ...layout(context),
        ...(scenario.id === "B6"
          ? {
              E2E_PACKAGED_BINARY_PATH: join(
                context.root,
                "dist",
                context.platform.startsWith("win32-") ? "pstdio.exe" : "pstdio",
              ),
            }
          : {}),
        BENCHMARK_SOURCE_SHA: context.sha,
        BENCHMARK_EVIDENCE_DIR:
          process.env.BENCHMARK_EVIDENCE_DIR ?? join(context.root, "test-results/production-performance"),
      },
    },
  ],
}));
export const suiteIds = suites.map((suite) => suite.id);
export const runsOn = (platforms: string[] | undefined, platform: string) => !platforms || platforms.includes(platform);
