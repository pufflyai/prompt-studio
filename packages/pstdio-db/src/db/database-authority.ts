import { randomUUID } from "node:crypto";

const authorities = new WeakMap<object, string>();
export const attachDatabaseAuthority = (database: object, path: string) => {
  authorities.set(database, path === ":memory:" ? `memory:${randomUUID()}` : `database:${path}`);
};
export const databaseAuthorityFor = (database: object) => {
  let identity = authorities.get(database);
  if (!identity) {
    identity = `memory:${randomUUID()}`;
    authorities.set(database, identity);
  }
  return identity;
};
