import { expect, test } from "bun:test";
import * as contracts from "./team-membership";

const accountId = "studio-team";
const code = "x".repeat(43);

test("desktop invite codes do not require recipient email or directory identifiers", () => {
  expect(contracts.teamMembershipWriteSchema.parse({ op: "inviteCode", accountId })).toEqual({
    op: "inviteCode",
    accountId,
  });
  expect(contracts.teamMembershipReadSchema.parse({ op: "inviteCodes", accountId })).toEqual({
    op: "inviteCodes",
    accountId,
  });
  expect(contracts.teamMembershipReadSchema.parse({ op: "inspectInviteCode", code })).toEqual({
    op: "inspectInviteCode",
    code,
  });
  expect(contracts.teamMembershipWriteSchema.parse({ op: "acceptInviteCode", code })).toEqual({
    op: "acceptInviteCode",
    code,
  });
});

test("created codes carry a strong secret once while list metadata cannot carry one", () => {
  const metadata = { id: "invitation", expiresAt: "2026-12-01T12:00:00.000Z" };
  expect(contracts.createdTeamInviteCodeSchema.parse({ ...metadata, code })).toEqual({ ...metadata, code });
  expect(contracts.teamInviteCodeSchema.parse(metadata)).toEqual(metadata);
  expect(contracts.teamInviteCodeSchema.safeParse({ ...metadata, code }).success).toBe(false);
  expect(contracts.createdTeamInviteCodeSchema.safeParse({ ...metadata, code: "guessable" }).success).toBe(false);
  expect(
    contracts.teamMembershipWriteSchema.safeParse({ op: "acceptInviteCode", code: "https://other.test/secret" })
      .success,
  ).toBe(false);
});

test("targeted invitations still require exactly one verified recipient", () => {
  expect(contracts.teamInviteRecipientSchema.safeParse({}).success).toBe(false);
  expect(contracts.teamInviteRecipientSchema.parse({ email: "Morgan@Fixture.test" })).toEqual({
    email: "morgan@fixture.test",
  });
  expect(
    contracts.teamMembershipWriteSchema.safeParse({ op: "inviteCode", accountId, email: "morgan@fixture.test" })
      .success,
  ).toBe(false);
});
