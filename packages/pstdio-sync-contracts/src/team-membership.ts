import { z } from "zod";
import { teamAccountSchema } from "./identity";
import { identitySchema } from "./wire";

export const teamInviteEmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const teamInviteSecretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const teamInvitationSchema = z.strictObject({
  id: identitySchema,
  email: teamInviteEmailSchema,
  expiresAt: z.iso.datetime(),
});

export const createdTeamInvitationSchema = teamInvitationSchema.extend({ url: z.url() });
export const teamMemberSchema = z.strictObject({
  userId: identitySchema,
  name: z.string(),
  role: teamAccountSchema.shape.role,
});

export const teamInvitationViewSchema = z.strictObject({
  state: z.enum(["pending", "joined", "consumed", "canceled", "expired", "wrong-identity", "unknown"]),
  teamName: z.string().optional(),
  signedInEmail: teamInviteEmailSchema.optional(),
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
  teamTarget.extend({ op: z.literal("invite"), email: teamInviteEmailSchema }),
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
