import { expect, test } from "bun:test";
import { teamMembershipReadSchema, teamMembershipWriteSchema } from "./team-membership";

test("team policy commands name installed sources without accepting package bytes or encryption keys", () => {
  const read = { op: "extensionPolicy", accountId: "team-a" };
  const manage = {
    op: "manageExtension",
    accountId: "team-a",
    projectId: "project-a",
    instanceId: "installed-instance",
    expectedSelection: null,
  };
  const remove = {
    op: "unmanageExtension",
    accountId: "team-a",
    extensionId: "fixture.private-tool",
    expectedSelection: "policy-revision",
  };
  expect(teamMembershipReadSchema.parse(read)).toEqual(read);
  expect(teamMembershipWriteSchema.parse(manage)).toEqual(manage);
  expect(teamMembershipWriteSchema.parse(remove)).toEqual(remove);
  expect(
    teamMembershipWriteSchema.safeParse({ ...manage, bytes: "private bytes", secret: "private key" }).success,
  ).toBe(false);
});
