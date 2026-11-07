import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkChoices } from "./choices";
import { SetupProvider } from "./provider";

test("shows preinstalled Home and Onboarding before work areas are selected", () => {
  const markup = renderToStaticMarkup(
    <SetupProvider>
      <WorkChoices
        selected={[]}
        installed={[
          "pstdio.pstdio-home",
          "pstdio.pstdio-onboarding",
          "pstdio.pstdio-base-themes",
          "pstdio.pstdio-skills",
        ]}
        onChange={() => {}}
      />
    </SetupProvider>,
  );
  expect(markup).toContain(">Home</");
  expect(markup).toContain(">Onboarding</");
});
