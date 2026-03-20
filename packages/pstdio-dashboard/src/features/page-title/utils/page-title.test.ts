import { describe, expect, it } from "bun:test";
import { getPageTitle } from "./page-title";

describe("getPageTitle", () => {
  it("returns Projects for the projects index route", () => {
    expect(getPageTitle("/projects")).toBe("Projects");
  });

  it("returns just the doc title when viewing a specific doc", () => {
    expect(getPageTitle("/projects/proj-1/docs", "Project Name", { docTitle: "Getting Started" })).toBe(
      "Getting Started",
    );
  });

  it("falls back to Docs when no doc title is provided", () => {
    expect(getPageTitle("/projects/proj-1/docs", "Project Name")).toBe("Project Name > Docs");
  });

  it("returns project tickets title for tickets route", () => {
    expect(getPageTitle("/projects/proj-1/tickets", "Project Name")).toBe("Project Name > Tickets");
  });

  it("returns ticket shorthand for ticket details route", () => {
    expect(getPageTitle("/projects/proj-1/tickets/PS-41", "Project Name")).toBe("Project Name > PS-41");
  });

  it("returns ticket and workspace attempt for workspace route", () => {
    expect(getPageTitle("/projects/proj-1/tickets/PS-41/workspaces/PS-41_A1", "Project Name")).toBe("PS-41 > A1");
  });

  it("returns just the session title for session detail route", () => {
    expect(
      getPageTitle("/projects/proj-1/sessions/session-123", "Project Name", {
        sessionTitle: "Fix login bug",
      }),
    ).toBe("Fix login bug");
  });

  it("falls back to Sessions when no session title is provided", () => {
    expect(getPageTitle("/projects/proj-1/sessions/session-123", "Project Name")).toBe("Project Name > Sessions");
  });

  it("returns settings section directly for tags", () => {
    expect(getPageTitle("/projects/proj-1/settings", "Project Name", { settingsPanel: "tags" })).toBe(
      "Project Name > Tags",
    );
  });

  it("returns settings section directly for danger zone", () => {
    expect(getPageTitle("/projects/proj-1/settings", "Project Name", { settingsPanel: "danger-zone" })).toBe(
      "Project Name > Danger Zone",
    );
  });

  it("returns hook name for hook settings", () => {
    expect(getPageTitle("/projects/proj-1/settings", "Project Name", { settingsPanel: "hook:pre-commit" })).toBe(
      "Project Name > pre-commit",
    );
  });

  it("returns template name for template settings", () => {
    expect(getPageTitle("/projects/proj-1/settings", "Project Name", { settingsPanel: "template:Bugfix" })).toBe(
      "Project Name > Bugfix",
    );
  });

  it("returns Settings when no settings panel is specified", () => {
    expect(getPageTitle("/projects/proj-1/settings", "Project Name")).toBe("Project Name > Settings");
  });

  it("returns section fallback when project name has not loaded", () => {
    expect(getPageTitle("/projects/proj-1/tickets/PS-41")).toBe("Project > PS-41");
  });

  it("falls back to app title when project route has no name yet", () => {
    expect(getPageTitle("/projects/proj-1/docs")).toBe("Project > Docs");
  });
});
