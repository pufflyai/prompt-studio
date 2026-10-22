import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { managerRequest } from "./manager-client";
import type { DeviceLogin } from "./native-store";

const workbenchesSchema = z.array(z.object({ workbenchId: identitySchema }));
const accountSchema = z.object({ features: z.object({ relay: z.boolean() }) });

export const readManagerAccount = async (login: DeviceLogin) => {
  const [account, projects] = await Promise.all([
    managerRequest(login.managerOrigin, "/v1/account", login.token).then((data) => accountSchema.parse(data)),
    managerRequest(login.managerOrigin, "/v1/workbenches", login.token).then((data) => workbenchesSchema.parse(data)),
  ]);
  return { credential: login.token, ids: projects.map((row) => row.workbenchId), features: account.features };
};
