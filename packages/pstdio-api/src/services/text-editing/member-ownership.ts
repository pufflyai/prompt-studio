import type { TextConnection } from "./types";

export const currentTextMembers = (connection: TextConnection) => [
  ...new Set([...connection.members.values(), ...connection.releasing.keys()]),
];
