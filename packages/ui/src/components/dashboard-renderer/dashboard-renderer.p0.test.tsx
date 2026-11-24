import { describe, expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToString } from "react-dom/server";
import { psTheme } from "@/theme";
import { type DashboardDataSource, type DashboardDefinition, DashboardRenderer } from "./index";

const value: DashboardDefinition = {
  mode: "vertical",
  widgets: [
    { id: "orders", title: "Orders today", kind: "metric", source: "sales", layout: { x: 0, y: 0, w: 4, h: 3 } },
  ],
};
const sources: DashboardDataSource[] = [
  { id: "sales", name: "Sales", metric: { value: "1,240", description: "Completed orders" } },
];
const render = (onChange?: (definition: DashboardDefinition) => void) =>
  renderToString(
    <ChakraProvider value={psTheme}>
      <DashboardRenderer title="Store" value={value} sources={sources} onChange={onChange} />
    </ChakraProvider>,
  );

describe("DashboardRenderer public component", () => {
  test("renders caller data and stays read-only without a change handler", () => {
    const html = render();
    expect(html).toContain("Orders today");
    expect(html).toContain("1,240");
    expect(html).toContain("Completed orders");
    expect(html).not.toContain("Edit dashboard");
  });

  test("offers editing when the caller can accept a definition", () => {
    expect(render(() => {})).toContain("Edit dashboard");
  });

  test("renders caller content with editing controls in the page toolbar", () => {
    const html = renderToString(
      <ChakraProvider value={psTheme}>
        <DashboardRenderer
          title="Default toolbar title"
          value={{
            ...value,
            widgets: [{ ...value.widgets[0], title: "", kind: "custom", source: "pipeline" }],
          }}
          sources={[{ id: "pipeline", name: "Pipeline history", content: <button>Show category</button> }]}
          onChange={() => {}}
          renderToolbar={(controls) => (
            <div aria-label="Page actions" role="toolbar">
              {controls}
            </div>
          )}
        />
      </ChakraProvider>,
    );
    expect(html).toContain('aria-label="Pipeline history"');
    expect(html).toContain("Show category");
    expect(html).toMatch(/aria-label="Page actions" role="toolbar">.*Edit dashboard/s);
    expect(html).not.toContain("Default toolbar title");
  });
});
