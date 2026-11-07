import { expect, test } from "@playwright/test";
import { installInteractionClock, readInteraction } from "../perf/perf-helpers";

// Critical risk: benchmark instrumentation must retain input work rather than report a healthy zero.
for (const input of ["pointer", "keyboard"] as const) {
  test(`the benchmark clock includes the ${input} event's long task`, async ({ page }) => {
    await installInteractionClock(page);
    await page.goto("data:text/html,<button data-perf-start>Measure</button>");
    await page.evaluate(() => {
      const button = document.querySelector("button")!;
      const block = (milliseconds: number) => {
        const until = performance.now() + milliseconds;
        while (performance.now() < until) {}
      };
      // Native pointerup precedes click within the same event task. A keyboard activation
      // similarly begins at keydown; its synthesized click must not replace that start.
      button.addEventListener("pointerup", () => block(15));
      let firstStart: number | undefined;
      button.addEventListener("keydown", () => {
        firstStart = window.__perfStart;
        block(15);
      });
      button.addEventListener("click", () => {
        if (firstStart !== undefined && window.__perfStart !== firstStart)
          throw new Error("The synthesized click replaced the keydown start");
        block(80);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.__perfSettled = performance.now();
          });
        });
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const button = page.getByRole("button", { name: "Measure" });
    if (input === "pointer") await button.click();
    else await button.press("Enter");
    expect(errors).toEqual([]);
    const result = await readInteraction(page);
    expect(result.longTasks.some((duration) => duration >= 80)).toBe(true);
  });
}
