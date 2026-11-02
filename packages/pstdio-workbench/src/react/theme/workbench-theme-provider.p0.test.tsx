import { describe, expect, test } from "bun:test";
import { UiScopeProvider, useThemePreference } from "@pstdio/ui";
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

test("a scoped nested provider keeps the enclosing provider's storage and controls", () => {
  const values = new Map([["theme-preference", "outer.dark"]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const markup = renderToStaticMarkup(
    <WorkbenchThemeProvider
      themeStorage={storage}
      initialThemePreference="outer.dark"
      themePreferences={[{ id: "outer.dark", mode: "dark" }]}
    >
      <UiScopeProvider active={false}>
        <WorkbenchThemeProvider initialThemePreference="pstdio-light">
          <ThemePreferenceProbe />
        </WorkbenchThemeProvider>
      </UiScopeProvider>
    </WorkbenchThemeProvider>,
  );
  expect(markup).toContain('data-theme-preference="outer.dark"');
});
