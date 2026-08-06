import { ensureApi } from "@/features/ensure-api";

export { builder, createHandler, handler } from "./notifications/list";

export const command = "inbox";
export const describe = "List pending notifications";
export const middlewares = [() => ensureApi(process.env.PSTDIO_API_URL)];
