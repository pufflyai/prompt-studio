import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("@chakra-ui/react", () => ({
  Flex: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
}));

mock.module("@tanstack/react-router", () => ({
  Outlet: () => <div>outlet</div>,
}));

mock.module("@pstdio/ui", () => ({
  Toaster: () => <div>toaster</div>,
}));

mock.module("@/features/page-title/hooks/use-page-title", () => ({
  usePageTitle: () => {},
}));

mock.module("@/features/sync/sync-provider", () => ({
  useBackendConnectionStatus: () => "connected",
}));

mock.module("@/features/sync/backend-connection-dot", () => ({
  BackendConnectionDot: () => <div>backend-connection-dot</div>,
}));

describe("Layout", () => {
  it("does not render the backend connection indicator", async () => {
    const { Layout } = await import("./layout");
    const markup = renderToStaticMarkup(<Layout />);

    expect(markup).toContain("outlet");
    expect(markup).toContain("toaster");
    expect(markup).not.toContain("backend-connection-dot");
  });
});
