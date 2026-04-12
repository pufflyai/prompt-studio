import { describe, expect, it } from "bun:test";
import { formatTicketBreadcrumbLabel } from "./ticket-breadcrumb";

describe("formatTicketBreadcrumbLabel", () => {
  it("returns shorthand when title is missing", () => {
    expect(formatTicketBreadcrumbLabel("PS-29", null)).toBe("PS-29");
  });

  it("returns shorthand and title when title exists", () => {
    expect(formatTicketBreadcrumbLabel("PS-29", "Improve breadcrumbs")).toBe("PS-29 Improve breadcrumbs");
  });

  it("truncates long titles", () => {
    expect(formatTicketBreadcrumbLabel("PS-29", "abcdefghijklmnopqrstuvwxyz", 10)).toBe("PS-29 abcdefghi…");
  });
});
