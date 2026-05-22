import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkbenchThemeProvider } from "./workbench-theme-provider";
import { WorkbenchThemeScope } from "./workbench-theme-scope";

describe("WorkbenchThemeScope", () => {
  test("does not introduce workbench-local theme state", () => {
    const markup = renderToStaticMarkup(
      <WorkbenchThemeProvider initialThemePreference="pstdio-dark">
        <WorkbenchThemeScope>
          <div>Workbench</div>
        </WorkbenchThemeScope>
      </WorkbenchThemeProvider>,
    );

    expect(markup).not.toContain("data-workbench-theme");
    expect(markup).not.toContain("--workbench-main-bg");
  });
});
