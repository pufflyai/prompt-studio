import { expect, test } from "@playwright/test";
import { teamSettingsFixture } from "./helpers/team-settings-fixture";

test("Team settings creates a team and opens project creation for its selected account", async ({ page, request }) => {
  // Critical: creation remains reachable after moving team administration out of Cloud's account card.
  const fixture = await teamSettingsFixture(page, request, { hasTeam: false });
  const settings = await fixture.open("Team");
  await settings.getByRole("button", { name: "Create team", exact: true }).click();
  await settings.getByRole("textbox", { name: "Team name", exact: true }).fill("New Team");
  await settings.getByRole("button", { name: "Create", exact: true }).click();
  await expect(settings.getByRole("button", { name: "Choose team", exact: true })).toHaveText(/New Team/);
  await page.getByRole("option", { name: "Cloud", exact: true }).click();
  const cloud = page.frameLocator('iframe[title="Cloud"]');
  await cloud.getByRole("button", { name: "Choose team", exact: true }).click();
  await cloud.getByRole("menuitem", { name: "New Team", exact: true }).click();
  await expect(cloud.getByText("Coming soon", { exact: true })).toBeVisible();
  await expect(cloud.getByRole("button", { name: "Create project", exact: true })).toHaveCount(0);
  fixture.team.features.relay = true;
  fixture.account.teamAccounts?.push(fixture.team);
  await page.reload();
  // Reload restores the open settings destination.
  await expect(cloud.getByRole("button", { name: "Choose team", exact: true })).toBeVisible();
  await cloud.getByRole("button", { name: "Choose team", exact: true }).click();
  await cloud.getByRole("menuitem", { name: "Studio Team", exact: true }).click();
  await cloud.getByRole("button", { name: "Create project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create project", exact: true });
  await expect(dialog.getByText("Account Studio Team", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("an owner invites with a desktop code and removes a member from the same Team page", async ({
  page,
  request,
  context,
}) => {
  // Critical: invitation secrets must stay in the dialog and removal requires confirmation.
  const fixture = await teamSettingsFixture(page, request);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const settings = await fixture.open("Team");
  await expect(settings.getByText("Riley Chen", { exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: "Remove Alex Morgan", exact: true })).toHaveCount(0);
  await settings.getByRole("button", { name: "Invite member", exact: true }).click();
  const invitation = settings.getByRole("dialog", { name: "Invite member", exact: true });
  await expect(invitation.getByRole("textbox", { name: "Team invite code", exact: true })).toHaveValue("c".repeat(43));
  await expect(invitation.getByRole("textbox", { name: /email|tenant|object/i })).toHaveCount(0);
  await expect(invitation.getByRole("button", { name: "Copy invite code", exact: true })).toBeVisible();
  await invitation.getByRole("button", { name: "Copy invite code", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("c".repeat(43));
  await invitation.getByRole("button", { name: "Done", exact: true }).click();
  await settings.getByRole("button", { name: "Remove Riley Chen", exact: true }).click();
  const remove = settings.getByRole("dialog");
  await expect(settings.getByText("Riley Chen", { exact: true })).toBeVisible();
  await remove.getByRole("button", { name: "Remove member", exact: true }).click();
  await expect(settings.getByText("Riley Chen", { exact: true })).toHaveCount(0);
  expect(fixture.writes.map(({ op }) => op)).toEqual(["inviteCode", "removeMember"]);
});

test("managed settings selects a verified source instance and releases its current policy selection", async ({
  page,
  request,
}) => {
  // Critical: the owner writes the current project instance and a selection fence through the public bridge.
  const fixture = await teamSettingsFixture(page, request);
  const settings = await fixture.open("Managed extensions");
  const checkbox = settings.getByRole("checkbox", { name: "Manage Prompt Studio Cloud", exact: true });
  await expect(checkbox).toBeEnabled();
  await checkbox.press("Space");
  await expect(checkbox).toBeChecked();
  expect(fixture.writes[0]).toMatchObject({
    op: "manageExtension",
    accountId: fixture.team.accountId,
    projectId: fixture.projectId,
    expectedSelection: null,
  });
  await checkbox.press("Space");
  await expect(checkbox).not.toBeChecked();
  expect(fixture.writes[1]).toEqual({
    op: "unmanageExtension",
    accountId: fixture.team.accountId,
    extensionId: "pstdio.cloud",
    expectedSelection: "managed-selection",
  });
});

test("members see managed policy read-only and retain project access and ownership handover controls", async ({
  page,
  request,
}) => {
  // Critical: owner-only team policy must not suppress full ordinary project-member capabilities.
  const fixture = await teamSettingsFixture(page, request, {
    role: "member",
    required: true,
    ownership: { id: "ownership-offer", ownerUserId: "alex", recipientUserId: "riley" },
  });
  const managed = await fixture.open("Managed extensions");
  const checkbox = managed.getByRole("checkbox", { name: "Manage Prompt Studio Cloud", exact: true });
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeDisabled();
  const team = await fixture.open("Team");
  await expect(team.getByRole("button", { name: "Invite member", exact: true })).toHaveCount(0);
  await expect(team.getByRole("button", { name: "Remove Alex Morgan", exact: true })).toHaveCount(0);
  await page.getByRole("option", { name: "Cloud", exact: true }).click();
  const cloud = page.frameLocator('iframe[title="Cloud"]');
  await cloud.getByRole("checkbox", { name: "Project access for Alex Morgan", exact: true }).press("Space");
  await cloud.getByRole("dialog").getByRole("button", { name: "Revoke access", exact: true }).click();
  await expect(cloud.getByRole("checkbox", { name: "Project access for Alex Morgan", exact: true })).not.toBeChecked();
  await expect(cloud.getByRole("button", { name: "Make local", exact: true })).toBeEnabled();
  expect(fixture.writes[0]).toEqual({
    op: "setProjectAccess",
    accountId: fixture.team.accountId,
    workbenchId: fixture.projectId,
    userId: "alex",
    granted: false,
  });
  await fixture.open("Team");
  await team.getByRole("button", { name: "Team actions", exact: true }).click();
  await team.getByRole("button", { name: "Accept ownership", exact: true }).click();
  expect(fixture.writes[1]).toEqual({
    op: "answerOwnership",
    accountId: fixture.team.accountId,
    offerId: "ownership-offer",
    decision: "accept",
  });
  await expect(team.getByRole("button", { name: "Invite member", exact: true })).toBeVisible();
});

test("editing an invite code while inspection is pending cannot approve a different team", async ({
  page,
  request,
}) => {
  // Critical: the inspected team and signed-in identity must match the code actually accepted.
  const first = "a".repeat(43);
  const second = "b".repeat(43);
  const delayed = Promise.withResolvers<void>();
  let firstRequested = false;
  const fixture = await teamSettingsFixture(page, request, {
    role: "member",
    hasTeam: false,
    inspect: async (code) => {
      if (code === first) {
        firstRequested = true;
        await delayed.promise;
      }
      return {
        state: "pending",
        teamName: code === first ? "First team" : "Second team",
        signedInEmail: "riley@example.test",
      };
    },
  });
  const settings = await fixture.open("Team");
  await settings.getByRole("button", { name: "Join team", exact: true }).click();
  const dialog = settings.getByRole("dialog", { name: "Join team", exact: true });
  const code = dialog.getByRole("textbox", { name: "Invite code", exact: true });
  try {
    await code.fill(first);
    await dialog.getByRole("button", { name: "Check code", exact: true }).click();
    await expect.poll(() => firstRequested).toBe(true);
    await code.fill(second);
    delayed.resolve();
    await expect(dialog.getByRole("button", { name: "Check code", exact: true })).toBeEnabled();
    await expect(dialog.getByText("First team", { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Join team", exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Check code", exact: true }).click();
    await expect(dialog.getByText("Second team", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Signed in as riley@example.test", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Join team", exact: true }).click();
    expect(fixture.writes).toEqual([{ op: "acceptInviteCode", code: second }]);
    expect(fixture.account.teamProjects).toEqual({});
  } finally {
    delayed.resolve();
  }
});
