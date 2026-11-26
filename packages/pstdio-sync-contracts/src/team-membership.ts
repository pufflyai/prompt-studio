import { z } from "zod";
import { accountSignInProviderSchema } from "./account-sign-in";
import { teamAccountSchema } from "./identity";
import { identitySchema } from "./wire";

export const teamInviteEmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const teamInviteSecretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const directoryId = z.string().trim().toLowerCase().pipe(z.guid());
export const microsoftInviteRecipientSchema = z.strictObject({ tenantId: directoryId, objectId: directoryId });
const recipientFields = z.strictObject({
  email: teamInviteEmailSchema.optional(),
  microsoft: microsoftInviteRecipientSchema.optional(),
});
const hasRecipient = ({ email, microsoft }: z.infer<typeof recipientFields>) =>
  (email === undefined) !== (microsoft === undefined);
export const teamInviteRecipientSchema = recipientFields.refine(
  hasRecipient,
  "Specify exactly one invitation recipient",
);
export type TeamInviteRecipient = z.infer<typeof teamInviteRecipientSchema>;

export const teamInvitationSchema = recipientFields
  .extend({ id: identitySchema, expiresAt: z.iso.datetime() })
  .refine(hasRecipient);
export const createdTeamInvitationSchema = teamInvitationSchema.safeExtend({ url: z.url() });
export const teamMemberSchema = z.strictObject({
  userId: identitySchema,
  name: z.string(),
  role: teamAccountSchema.shape.role,
});

export const teamInvitationViewSchema = z.strictObject({
  state: z.enum(["pending", "joined", "consumed", "canceled", "expired", "wrong-identity", "unknown"]),
  teamName: z.string().optional(),
  signedInEmail: teamInviteEmailSchema.optional(),
  provider: accountSignInProviderSchema.optional(),
});
export const joinedTeamSchema = z.strictObject({ state: z.literal("joined"), accountId: identitySchema });

export type TeamInvitation = z.infer<typeof teamInvitationSchema>;
export type CreatedTeamInvitation = z.infer<typeof createdTeamInvitationSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamInvitationView = z.infer<typeof teamInvitationViewSchema>;
export type JoinedTeam = z.infer<typeof joinedTeamSchema>;

const teamTarget = z.strictObject({ accountId: identitySchema });
const invitationLink = z.strictObject({ url: z.url().max(2048) });
export const teamMembershipReadSchema = z.discriminatedUnion("op", [
  teamTarget.extend({ op: z.literal("members") }),
  teamTarget.extend({ op: z.literal("invitations") }),
  invitationLink.extend({ op: z.literal("inspectInvitation") }),
]);
export const teamMembershipWriteSchema = z.discriminatedUnion("op", [
  teamTarget.extend({ op: z.literal("invite"), ...recipientFields.shape }).refine(hasRecipient),
  teamTarget.extend({ op: z.literal("cancelInvitation"), invitationId: identitySchema }),
  teamTarget.extend({ op: z.literal("removeMember"), userId: identitySchema }),
  teamTarget.extend({ op: z.literal("leave") }),
  invitationLink.extend({ op: z.literal("acceptInvitation") }),
]);

export type TeamMembershipRead = z.infer<typeof teamMembershipReadSchema>;
export type TeamMembershipWrite = z.infer<typeof teamMembershipWriteSchema>;
export type TeamMembershipReadResult<Request extends TeamMembershipRead> = {
  members: TeamMember[];
  invitations: TeamInvitation[];
  inspectInvitation: TeamInvitationView;
}[Request["op"]];
export type TeamMembershipWriteResult<Request extends TeamMembershipWrite> = {
  invite: CreatedTeamInvitation;
  cancelInvitation: { ok: true };
  removeMember: { ok: true };
  leave: { ok: true };
  acceptInvitation: JoinedTeam;
}[Request["op"]];
