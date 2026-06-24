import { API_URL } from "@/features/api-url";
import { ensureApi } from "@/features/ensure-api";

export { builder, createHandler, handler } from "./notifications/list";

export const command = "inbox";
export const describe = "List pending notifications";
export const middlewares = [() => ensureApi(API_URL)];
