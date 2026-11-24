import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { accountEvents } from "@pstdio/sdk/extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { homePage } from "../helpers/home-loading";

const accountId = "personal-account";
const enabled = "studio-team-account";
const denied = "paused-team-account";
const managerOrigin = "https://accounts.example.test";
const team = (teamId: string, label: string, relay: boolean) =>
  ({ accountId: teamId, name: label, role: "owner", features: { relay } }) as const;

const openProjectPicker = async (page: Page, request: APIRequestContext, personalName: string) => {
  const personal = await request.post("/v1/projects", { data: folderProjectInput({ name: personalName }) });
  expect(personal.ok()).toBe(true);
  const { id } = await personal.json();
  let teamAccounts = [team(enabled, "Studio Team", true), team(denied, "Waiting Team", false)];
  await page.route("**/v1/account", (route) =>
    route.fulfill({
      json: {
        login: { accountId, deviceId: "account-test-device", managerOrigin, relayOrigin: "https://relay.example.test" },
        cloudProjects: [],
        cloudProjectsLoaded: true,
        features: { relay: false },
        teamAccounts,
      },
    }),
  );
  await page.route(/\/v1\/account\/projects(?:\?|$)/, (route) => {
    const scope = new URL(route.request().url()).searchParams.get("accountId") ?? accountId;
    return route.fulfill({
      json: { account: { accountId: scope, managerOrigin }, membershipKnown: true, projects: [], deletions: [] },
    });
  });
  await page.addInitScript(() => {
    if (window === window.top) localStorage.setItem("onboarding-complete", "true");
  });
  const dashboard = await page.goto(`/projects/${id}/`);
  expect(dashboard?.ok()).toBe(true);
  await expect(homePage(page)).toBeVisible();
  const switcher = page.getByRole("button", { name: "Switch project", exact: true });
  if (await switcher.isVisible()) await switcher.click();
  return {
    async removeTeams() {
      teamAccounts = [];
      const refreshed = page.waitForResponse((response) => new URL(response.url()).pathname === "/v1/account");
      const event = await request.post(`/v1/projects/${id}/extensions/events/dispatch`, {
        data: { eventId: accountEvents.changed.id, payload: {} },
      });
      expect(event.status()).toBe(204);
      await refreshed;
    },
  };
};

test("creating a team project keeps the selected account through folder selection", async ({ page, request }) => {
  const personalName = "Personal opening";
  const name = "Studio notebook";
  await page.route("**/v1/projects", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 400, json: { error: "Test project was not saved" } })
      : route.continue(),
  );
  await openProjectPicker(page, request, personalName);

  await page.getByRole("button", { name: "Waiting Team", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create project", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Studio Team", exact: true }).click();
  await expect(page.getByRole("option", { name: personalName })).toHaveCount(0);
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page.getByText("Account Studio Team", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Project name" }).fill(name);
  await page.getByRole("button", { name: "Choose folder", exact: true }).click();
  const path = page.getByRole("textbox", { name: "Folder path", exact: true });
  await path.fill(folderProjectInput({}).initial_workspace.params.path);
  await path.press("Enter");
  const projectRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/v1/projects" && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Open folder", exact: true }).click();
  expect((await projectRequest).postDataJSON()).toMatchObject({ name, teamAccountId: enabled });
  await expect(page.getByText("Test project was not saved", { exact: true })).toBeVisible();
});

test("losing the selected team keeps project creation scoped until the person switches accounts", async ({
  page,
  request,
}) => {
  const personalName = "Personal selection after team removal";
  const picker = await openProjectPicker(page, request, personalName);
  const studio = page.getByRole("button", { name: "Studio Team", exact: true });
  const personal = page.getByRole("button", { name: "Personal", exact: true });
  const personalProject = page.getByRole("option", { name: personalName });
  const create = page.getByRole("button", { name: "Create project", exact: true });
  const unavailable = page.getByText("This team is unavailable.", { exact: true });

  await studio.click();
  await expect(create).toBeEnabled();
  await expect(personalProject).toHaveCount(0);
  await picker.removeTeams();
  await expect(studio).toHaveCount(0);
  await expect(create).toBeDisabled();
  await expect(unavailable).toBeVisible();
  await expect(personalProject).toHaveCount(0);
  await expect(personal).toHaveAttribute("aria-pressed", "false");

  await personal.click();
  await expect(unavailable).toBeHidden();
  await expect(personalProject).toBeVisible();
  await expect(create).toBeEnabled();
});
