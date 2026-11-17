import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";

interface Case {
  id: string;
  location: { file: string };
  titlePath(): string[];
  parent: { project(): { name: string } | undefined };
}
// Structural reporter types keep scope planning independent of installed Playwright.
export default class PlanReporter {
  private selected: Case[] = [];
  private finished = new Map<string, { id: string; file: string; outcome: string; retry: number; title: string }>();
  private errors: string[] = [];
  private shard = "1/1";
  onBegin(config: { shard?: { current: number; total: number } }, suite: { allTests(): Case[] }) {
    this.selected = suite.allTests();
    this.shard = config.shard ? `${config.shard.current}/${config.shard.total}` : "1/1";
    if (this.shard !== process.env.CI_PLAN_SHARD) this.errors.push("Unexpected Playwright shard");
  }
  onTestEnd(test: Case, result: { status: string; retry: number }) {
    if (this.finished.has(test.id)) this.errors.push(`Repeated case: ${test.id}`);
    this.finished.set(test.id, {
      id: test.id,
      title: test.titlePath().join(" > "),
      file: relative(process.env.CI_TEST_ROOT!, test.location.file).replaceAll("\\", "/"),
      outcome: result.status,
      retry: result.retry,
    });
  }
  onError(error: { message?: string }) {
    this.errors.push(error.message ?? "Playwright global error");
  }
  onEnd(result: { status: string }) {
    const path = process.env.CI_PLAN_BROWSER_EVIDENCE;
    if (!path) return;
    const terminal = [...this.finished.values()];
    const complete =
      !this.errors.length &&
      this.finished.size === this.selected.length &&
      this.selected.every((test) => this.finished.has(test.id)) &&
      terminal.every((entry) => entry.outcome !== "interrupted" && entry.retry === 0) &&
      result.status !== "interrupted" &&
      result.status !== "timedout";
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify(
        {
          planDigest: process.env.CI_PLAN_DIGEST,
          runId: process.env.CI_PLAN_RUN_ID,
          executionId: process.env.CI_TEST_EXECUTION_ID,
          selected: this.selected.map((test) => test.id),
          selection: this.selected.map((test) => ({
            id: test.id,
            file: relative(process.env.CI_TEST_ROOT!, test.location.file).replaceAll("\\", "/"),
            project: test.parent.project()?.name ?? "",
          })),
          shard: this.shard,
          cases: terminal,
          errors: this.errors,
          complete,
          status: result.status,
        },
        null,
        2,
      ),
    );
  }
}
