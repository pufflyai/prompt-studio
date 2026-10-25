import { describe, expect, test } from "bun:test";
import { useThemePreference } from "@pstdio/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkbenchThemeProvider } from "./workbench-theme-provider";

const ThemePreferenceProbe = () => {
  const { themePreference } = useThemePreference();

  return <span data-theme-preference={themePreference}>Workbench</span>;
};

describe("WorkbenchThemeProvider", () => {
  test("provides the shared UI theme preference context", () => {
    const markup = renderToStaticMarkup(
      <WorkbenchThemeProvider initialThemePreference="pstdio-dark">
        <ThemePreferenceProbe />
      </WorkbenchThemeProvider>,
    );

    expect(markup).toContain('data-theme-preference="pstdio-dark"');
  });
});
