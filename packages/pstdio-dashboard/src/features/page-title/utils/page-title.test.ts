import { describe, expect, it } from "bun:test";
import { getPageTitle } from "./page-title";

describe("getPageTitle", () => {
  it("returns Projects for the projects index route", () => {
    expect(getPageTitle("/projects")).toBe("Projects");
  });

  it("returns project docs title for docs route", () => {
    expect(getPageTitle("/projects/proj-1/docs", "Project Name")).toBe("Project Name > Docs");
  });

  it("returns project tickets title for tickets route", () => {
    expect(getPageTitle("/projects/proj-1/tickets", "Project Name")).toBe("Project Name > Tickets");
  });

  it("returns project tickets title for ticket details route", () => {
    expect(getPageTitle("/projects/proj-1/tickets/PS-41", "Project Name")).toBe("Project Name > Tickets");
  });

  it("falls back to app title when project route has no name yet", () => {
    expect(getPageTitle("/projects/proj-1/docs")).toBe("Prompt Studio");
  });
});
