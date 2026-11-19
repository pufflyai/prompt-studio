import { sql } from "drizzle-orm";

// A provider reservation address contains no project identifier.
export const reservationPrefix = "relay-reservations/";
export const reservationKey = () => `${reservationPrefix}${crypto.randomUUID()}`;
export const reservationLock = (key: string) => sql`hashtextextended(${`relay-reservation:${key}`}, 0)`;
