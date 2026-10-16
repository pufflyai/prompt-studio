import type { z } from "zod";
import { registrationSchema, replacementSchema, revokeSchema } from "./contracts";
import type { ManagerDatabase } from "./database";
import { listEnvironments } from "./environments";
import {
  registerCredentialInTransaction,
  replaceCredentialInTransaction,
  revokeCredentialsInTransaction,
} from "./grants";
import { withOwnerSession } from "./owner-session";

const ownerRegistrationSchema = registrationSchema.omit({ accountId: true });
const ownerReplacementSchema = replacementSchema.omit({ accountId: true });
const ownerRevokeSchema = revokeSchema.omit({ accountId: true });

export const createOwnerEnvironments = (db: ManagerDatabase, token: string) => ({
  async register(input: z.input<typeof ownerRegistrationSchema>) {
    const intent = ownerRegistrationSchema.parse(input);
    return withOwnerSession(db, token, (transaction, accountId) =>
      registerCredentialInTransaction(transaction, { ...intent, accountId }),
    );
  },
  async replace(input: z.input<typeof ownerReplacementSchema>) {
    const intent = ownerReplacementSchema.parse(input);
    return withOwnerSession(db, token, (transaction, accountId) =>
      replaceCredentialInTransaction(transaction, { ...intent, accountId }),
    );
  },
  async revoke(input: z.input<typeof ownerRevokeSchema>) {
    const intent = ownerRevokeSchema.parse(input);
    return withOwnerSession(db, token, (transaction, accountId) =>
      revokeCredentialsInTransaction(transaction, { ...intent, accountId }),
    );
  },
  environments: () => withOwnerSession(db, token, (transaction, accountId) => listEnvironments(transaction, accountId)),
});
