import type { TextEditingRequest, TextOpenInput, TextSourceGrant } from "pstdio-api-contracts/extension-kernel";
import { textEditingFailure } from "../extensions/text-editing-codec";
import type { TextEditingConnection } from "./text-editing";

type Source = TextOpenInput | "selected";
interface Member {
  handle: string;
  generation: number;
  source?: Source;
  grant?: TextSourceGrant;
}
/** Logical membership survives a transport lease. Source admission remains entirely host-owned. */
export const createTextGuestMembers = (connection: TextEditingConnection, generation: () => number) => {
  const members = new Map<string, Member>();
  let selected: { token: string; generation: number } | undefined;
  const sourceFor = (input: TextOpenInput) => {
    if (!("grant" in input)) return { source: input, generation: generation() };
    if (input.grant.token === selected?.token) return { source: "selected" as const, generation: selected.generation };
    for (const member of members.values())
      if (member.grant?.token === input.grant.token)
        return { source: member.source ?? input, generation: member.generation };
    return { source: input, generation: generation() };
  };
  const open = async (input: Extract<TextEditingRequest, { operation: "open" }>) => {
    const attempt = generation();
    const member = members.get(input.memberId);
    if (!member) return connection.request(input);
    const origin = member.source ? { source: member.source, generation: member.generation } : sourceFor(input.input);
    member.source ??= origin.source;
    if (member.generation !== generation())
      await connection.request({ operation: "register", memberId: input.memberId });
    if (origin.generation !== generation()) {
      if (origin.source === "selected") {
        const grant = await connection.request({ operation: "current" });
        if (!grant) throw textEditingFailure("grant_invalid", "This placement has no selected source");
        input = { ...input, input: { grant } };
      } else input = { ...input, input: origin.source };
    }
    if (attempt !== generation())
      throw textEditingFailure("connection_reset", "The text connection changed during admission", true);
    const result = await connection.request(input);
    if (attempt !== generation())
      throw textEditingFailure("connection_reset", "This opening reply belongs to an earlier text connection", true);
    member.handle = result.handle;
    member.grant = result.grant;
    member.generation = attempt;
    return result;
  };
  const guardHandle = async (input: TextEditingRequest & { handle: string }) => {
    const entry = [...members].find(([, member]) => member.handle === input.handle);
    if (!entry || entry[1].generation === generation()) return false;
    if (input.operation !== "close")
      throw textEditingFailure("connection_reset", "The text session needs to rejoin its host", true);
    await connection.request({ operation: "abandon", memberId: entry[0] });
    members.delete(entry[0]);
    return true;
  };
  const forgetHandle = (handle: string) => {
    for (const [id, member] of members) if (member.handle === handle) members.delete(id);
  };
  return {
    entries: () => members.entries(),
    registerAll: () =>
      Promise.all([...members.keys()].map((memberId) => connection.request({ operation: "register", memberId }))),
    async request(input: TextEditingRequest) {
      const attempt = generation();
      if (input.operation === "register") {
        if (!members.has(input.memberId)) members.set(input.memberId, { handle: "", generation: generation() });
      }
      if (input.operation === "open") return open(input);
      if ("handle" in input && (await guardHandle(input))) return;
      const result = await connection.request(input);
      if (attempt !== generation())
        throw textEditingFailure("connection_reset", "This reply belongs to an earlier text connection", true);
      if (input.operation === "current" && result)
        selected = { token: (result as TextSourceGrant).token, generation: attempt };
      if (input.operation === "abandon") members.delete(input.memberId);
      if (input.operation === "close") forgetHandle(input.handle);
      return result;
    },
  };
};
