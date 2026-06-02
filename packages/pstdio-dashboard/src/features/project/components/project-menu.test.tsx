import { describe, expect, it, mock } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let navigateCalls: unknown[] = [];
let onSelectProjects: (() => void) | null = null;

mock.module("@tanstack/react-router", () => ({
  useNavigate: () => (input: unknown) => navigateCalls.push(input),
  useParams: () => ({ projectId: "project-1" }),
}));

mock.module("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

mock.module("@pstdio/ui", () => ({
  SidebarProjectMenu: (props: { name: string; projectsLabel: string; onSelectProjects: () => void }) => {
    onSelectProjects = props.onSelectProjects;
    return createElement("button", null, `${props.name}:${props.projectsLabel}`);
  },
}));

mock.module("@/features/project/hooks/use-project", () => ({
  useProject: () => ({ data: { name: "Project One" } }),
}));

mock.module("@/features/project-list/components/project-picker-provider", () => ({
  useOptionalProjectPickerContext: () => null,
  useProjectPickerContext: () => {
    throw new Error("useProjectPickerContext must be used inside a ProjectPickerProvider");
  },
}));

const getOnSelectProjects = () => {
  if (!onSelectProjects) {
    throw new Error("Expected project menu select handler.");
  }

  return onSelectProjects;
};

describe("ProjectMenu", () => {
  it("falls back to the projects route when the picker provider is unavailable", async () => {
    navigateCalls = [];
    onSelectProjects = null;

    const { ProjectMenu } = await import("./project-menu");

    expect(() => renderToStaticMarkup(createElement(ProjectMenu))).not.toThrow();

    getOnSelectProjects()();

    expect(navigateCalls).toEqual([{ to: "/projects" }]);
  });
});
