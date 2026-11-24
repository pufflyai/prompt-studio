import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

test("Cloud status toggles and opens its app-wide settings with keyboard recovery", async ({ page, request }) => {
  // Critical: sign-in and account controls must remain reachable from the status item.
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Cloud settings" }),
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  await page.goto(`/projects/${project.id}/`);
  const status = page.frameLocator('iframe[title="Prompt Studio Cloud"]');
  const detailsFrame = page.locator('iframe[title="Cloud details"]');
  const details = page.frameLocator('iframe[title="Cloud details"]');
  await expect(status.getByTestId("cloud-status-item")).toHaveText("Sign in");
  await page.locator("footer").getByRole("button", { name: "Prompt Studio Cloud", exact: true }).click();
  await expect(details.getByRole("button", { name: "Cloud settings" })).toBeVisible();
  await page.locator("footer").getByRole("button", { name: "Prompt Studio Cloud", exact: true }).click();
  await expect(detailsFrame).toBeHidden();
  await page.locator("footer").getByRole("button", { name: "Prompt Studio Cloud", exact: true }).click();
  await details.getByRole("button", { name: "Cloud settings" }).click();
  const settings = page.frameLocator('iframe[title="Cloud"]');
  await expect(settings.getByRole("button", { name: "Sign in with Google", exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: "Sign in with Microsoft", exact: true })).toBeVisible();
  await expect(settings.getByText("Not signed in", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('iframe[title="Cloud"]')).toBeHidden();
  await expect(status.getByTestId("cloud-status-item")).toBeVisible();
});

test("Cloud settings can create a team and open project creation for the selected owner", async ({ page, request }) => {
  const createdProject = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Personal Cloud settings" }),
  });
  expect(createdProject.ok()).toBe(true);
  const { id } = await createdProject.json();
  const readyTeam = { accountId: "ready-team-account", name: "Ready Team", role: "owner", features: { relay: true } };
  const memberTeam = {
    accountId: "reader-team-account",
    name: "Reader Team",
    role: "member",
    features: { relay: true },
  };
  const teams = [readyTeam, memberTeam];
  let syncState = "local";
  await page.route("**/v1/account", (route) =>
    route.fulfill({
      json: {
        login: {
          accountId: "fixture-personal",
          deviceId: "fixture-device",
          managerOrigin: "https://accounts.example.test",
          relayOrigin: "https://relay.example.test",
        },
        cloudProjects: [],
        cloudProjectsLoaded: true,
        features: { relay: true },
        teamAccounts: teams,
        teamProjectOwners: { [id]: memberTeam.accountId },
      },
    }),
  );
  await page.route(`**/v1/account/projects/${id}/sync*`, (route) =>
    route.fulfill({ json: { state: syncState, offlineReady: false } }),
  );
  await page.route("**/v1/account/devices*", (route) => route.fulfill({ json: [] }));
  await page.route("**/v1/account/teams", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({
      name: "Studio Team",
      expected: { accountId: "fixture-personal", managerOrigin: "https://accounts.example.test" },
    });
    const team = { accountId: "created-team-account", name: "Studio Team", role: "owner", features: { relay: false } };
    teams.push(team);
    await route.fulfill({ json: team });
  });

  await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  await page.goto(`/projects/${id}/`);
  await page.locator("footer").getByRole("button", { name: "Prompt Studio Cloud", exact: true }).click();
  await page.frameLocator('iframe[title="Cloud details"]').getByRole("button", { name: "Cloud settings" }).click();
  const settings = page.frameLocator('iframe[title="Cloud"]');
  await expect(settings.getByText("Owning account Reader Team", { exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: "Sync with Cloud", exact: true })).toHaveCount(0);
  await settings.getByRole("button", { name: "Create team", exact: true }).click();
  await settings.getByRole("textbox", { name: "Team name" }).fill("Studio Team");
  await settings.getByRole("button", { name: "Create", exact: true }).click();
  await expect(settings.getByRole("button", { name: "Studio Team", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(settings.getByText("Coming soon", { exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: "Create project", exact: true })).toHaveCount(0);
  await settings.getByRole("button", { name: "Ready Team", exact: true }).click();
  await settings.getByRole("button", { name: "Create project", exact: true }).click();
  const projectDialog = page.getByRole("dialog", { name: "Create project" });
  await expect(projectDialog.getByText("Account Ready Team", { exact: true })).toBeVisible();
  await projectDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(projectDialog).toBeHidden();

  memberTeam.role = "owner";
  syncState = "synced";
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Cloud" })).toBeVisible();
  await settings.getByRole("button", { name: "Make local", exact: true }).click();
  const confirmation = settings.getByRole("dialog");
  await expect(confirmation.getByText("Make Personal Cloud settings local?", { exact: true })).toBeVisible();
  await expect(confirmation.getByText("Owning account Reader Team", { exact: true })).toBeVisible();
});

test("Cloud settings checks the signed-in identity before offering to join a team", async ({ page, request }) => {
  const createdProject = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Cloud invitation" }),
  });
  expect(createdProject.ok()).toBe(true);
  const { id } = await createdProject.json();
  const expected = { accountId: "other-person", managerOrigin: "https://accounts.example.test" };
  const secret = "e2e-invitation-fixture";
  const invitation = `${expected.managerOrigin}/v1/team-invitation#${secret}`;
  await page.route("**/v1/account", (route) =>
    route.fulfill({
      json: {
        login: { ...expected, deviceId: "fixture-device", relayOrigin: "https://relay.example.test" },
        cloudProjects: [],
        cloudProjectsLoaded: true,
        features: { relay: true },
        teamAccounts: [],
        teamProjectOwners: {},
      },
    }),
  );
  await page.route(`**/v1/account/projects/${id}/sync*`, (route) =>
    route.fulfill({ json: { state: "local", offlineReady: false } }),
  );
  await page.route("**/v1/account/devices*", (route) => route.fulfill({ json: [] }));
  await page.route("**/v1/account/team-membership/read", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().url()).not.toContain(secret);
    expect(route.request().postDataJSON()).toEqual({
      request: { op: "inspectInvitation", url: invitation },
      expected,
    });
    await route.fulfill({ json: { state: "wrong-identity", signedInEmail: "other@example.test" } });
  });

  await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  await page.goto(`/projects/${id}/`);
  await page.locator("footer").getByRole("button", { name: "Prompt Studio Cloud", exact: true }).click();
  await page.frameLocator('iframe[title="Cloud details"]').getByRole("button", { name: "Cloud settings" }).click();
  const settings = page.frameLocator('iframe[title="Cloud"]');
  await settings.getByRole("button", { name: "Use an invitation" }).click();
  await settings.getByRole("textbox", { name: "Team invitation link" }).fill(invitation);
  await settings.getByRole("button", { name: "Check link" }).click();
  await expect(settings.getByText("Signed in as other@example.test", { exact: true })).toBeVisible();
  await expect(settings.getByText("Sign in with the Google account that received this invitation.")).toBeVisible();
  await expect(settings.getByRole("button", { name: "Join team" })).toHaveCount(0);
});
