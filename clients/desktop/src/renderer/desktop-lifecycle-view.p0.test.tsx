import { expect, test } from "bun:test";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { DesktopLifecycleView } from "./desktop-lifecycle-app";
import { DesktopStartupProgress } from "./desktop-starting-state";

const copyDiagnostics = async () => {};

test("desktop recovery uses a persistent empty state with the available actions", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <DesktopLifecycleView
        state={{
          kind: "recovery",
          error: {
            code: "unexpected_exit",
            message: "The runtime closed unexpectedly.",
            actions: ["retry", "quit"],
          },
        }}
      />
    </ChakraProvider>,
  );
  expect(html.includes('class="chakra-empty-state__root')).toBe(true);
  expect(html).toContain('role="alert"');
  expect(html).toContain("The runtime closed unexpectedly.");
  expect(html).toContain(">Retry</button>");
  expect(html).toContain(">Copy diagnostics</button>");
  expect(html).toContain(">Quit</button>");
  expect(html).not.toContain('aria-label="Dismiss"');
  expect(html).not.toContain(">Open logs</button>");
});

test("slow startup describes the current phase and offers a diagnostics action in an empty state", () => {
  const render = (takingLonger: boolean) =>
    renderToStaticMarkup(
      <ChakraProvider value={psTheme}>
        <DesktopStartupProgress phase="migrations" takingLonger={takingLonger} copyDiagnostics={copyDiagnostics} />
      </ChakraProvider>,
    );
  expect(render(false)).not.toContain('aria-label="Copy diagnostics"');
  const html = render(true);
  expect(html.includes('class="chakra-empty-state__root')).toBe(true);
  expect(html).toContain('role="status"');
  expect(html).toContain("This is taking longer than usual");
  expect(html).toContain("Updating your local data…");
  expect(html).toContain('aria-label="Copy diagnostics"');
});
