import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import type { NativeChatHostProps } from "@pstdio/workbench/extensions";
import { WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n/config";
import { useNativeHarnessAccount } from "./use-native-harness-account";

const setup = (initializing: boolean, agents: unknown[] = [], value?: { harnessId: string }) => {
  const queries = new QueryClient();
  queries.setQueryData(["agents-info", "p"], agents);
  const Notice = () => {
    const account = useNativeHarnessAccount({
      workbench: createWorkbench(),
      projectId: "p",
      binding: { controlId: "provider" },
      value,
      session: {} as NativeChatHostProps["session"],
      initializing,
    });
    return (
      <>
        {account?.setup}
        {account?.notice}
      </>
    );
  };
  return renderToStaticMarkup(
    <QueryClientProvider client={queries}>
      <I18nextProvider i18n={i18n}>
        <WorkbenchThemeProvider>
          <Notice />
        </WorkbenchThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  );
};

test("new chat suppresses unavailable feedback until draft hydration and harness selection settle", () => {
  expect(setup(true).includes("lucide-triangle-alert")).toBe(false);
  expect(
    setup(false, [
      { id: "installed", name: "Installed", availability: { type: "INSTALLED" }, supportsModels: true },
    ]).includes("lucide-triangle-alert"),
  ).toBe(false);
  expect(setup(false).includes("lucide-triangle-alert")).toBe(true);
  expect(setup(false, [], { harnessId: "removed" }).includes("lucide-triangle-alert")).toBe(true);
});
