import { describe, expect, test } from "bun:test";
import { createNavigationRegistry } from "./navigation-registry";

describe("createNavigationRegistry", () => {
  test("resolves deep links and delegates resource navigation to host adapters", async () => {
    const navigation = createNavigationRegistry();
    const visited: string[] = [];

    navigation.registerParser(
      {
        id: "project-uri",
        priority: 20,
        canParse: (location) => location.startsWith("pstdio://project/"),
        parse: (location) => ({
          kind: "project",
          uri: location,
          id: location.replace("pstdio://project/", ""),
          label: "Project",
        }),
      },
      { source: "module", ownerId: "dashboard.project" },
    );
    navigation.registerNavigator(
      {
        id: "dashboard-router",
        priority: 10,
        canNavigate: (resource) => resource.kind === "project",
        createHref: (resource) => `/projects/${resource.id}/settings`,
        navigate: (resource) => {
          const href = `/projects/${resource.id}/settings`;
          visited.push(href);
          return href;
        },
      },
      { source: "module", ownerId: "dashboard.host" },
    );

    const resource = navigation.resolveLocation("pstdio://project/project-1");

    expect(resource).toMatchObject({
      kind: "project",
      uri: "pstdio://project/project-1",
      id: "project-1",
    });
    expect(navigation.listParsers()[0]?.ownerId).toBe("dashboard.project");
    expect(navigation.createHref(resource)).toBe("/projects/project-1/settings");
    await expect(navigation.navigateResource(resource)).resolves.toBe("/projects/project-1/settings");
    expect(visited).toEqual(["/projects/project-1/settings"]);
  });

  test("fails clearly when no parser or navigator can handle the input", async () => {
    const navigation = createNavigationRegistry();

    expect(() => navigation.resolveLocation("pstdio://missing/1")).toThrow(
      "No navigation parser registered for location: pstdio://missing/1",
    );
    await expect(navigation.navigateResource({ kind: "project", uri: "pstdio://project/project-1" })).rejects.toThrow(
      "No navigator registered for resource kind: project",
    );
  });
});
