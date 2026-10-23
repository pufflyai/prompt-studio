import { isIPv4, isIPv6 } from "node:net";

// Agent output decides which links appear in chat, so link icons must never reach the local network.
const LOCAL_IPV4_RANGES = [
  ["0.0.0.0", 8], // "this network"; connecting to it reaches the local host
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, including cloud metadata services
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 4], // multicast
] as const;

const ipv4Value = (address: string) => address.split(".").reduce((value, part) => value * 256 + Number(part), 0);

const isPublicIPv4 = (value: number) =>
  !LOCAL_IPV4_RANGES.some(([base, bits]) => value >>> (32 - bits) === ipv4Value(base) >>> (32 - bits));

const ipv6Groups = (address: string) => {
  let text = address.toLowerCase();
  const embedded = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (embedded) {
    const value = ipv4Value(embedded[1]!);
    text = `${text.slice(0, embedded.index)}${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`;
  }
  const [head = "", tail] = text.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const zeros = tail === undefined ? [] : Array(8 - left.length - right.length).fill("0");
  return [...left, ...zeros, ...right].map((group) => Number.parseInt(group, 16));
};

// IPv6 forms that carry an IPv4 address reach that IPv4 host, so they follow the IPv4 rule.
const embeddedIPv4 = (groups: number[]) => {
  const [first, second, third] = groups;
  const zeros = (from: number, to: number) => groups.slice(from, to).every((group) => group === 0);
  const last32 = groups[6]! * 0x10000 + groups[7]!;
  if (zeros(0, 5) && (groups[5] === 0xffff || groups[5] === 0)) return last32; // ::ffff:a.b.c.d and ::a.b.c.d
  if (zeros(0, 4) && groups[4] === 0xffff && groups[5] === 0) return last32; // ::ffff:0:a.b.c.d
  if (first === 0x64 && second === 0xff9b && zeros(2, 6)) return last32; // NAT64 64:ff9b::/96
  if (first === 0x2002) return second! * 0x10000 + third!; // 6to4 2002::/16
  return undefined;
};

export const isPublicAddress = (address: string) => {
  // Link-local addresses from DNS can carry a zone, such as `fe80::1%en0`.
  const plain = address.split("%")[0] ?? "";
  if (isIPv4(plain)) return isPublicIPv4(ipv4Value(plain));
  if (!isIPv6(plain)) return false;
  const groups = ipv6Groups(plain);
  const ipv4 = embeddedIPv4(groups);
  if (ipv4 !== undefined) return isPublicIPv4(ipv4);
  const [first, second, third] = groups;
  if (first === 0x64 && second === 0xff9b && third === 1) return false; // local-use NAT64 64:ff9b:1::/48
  if ((first! & 0xfe00) === 0xfc00) return false; // unique-local fc00::/7
  if ((first! & 0xff80) === 0xfe80) return false; // link-local fe80::/10 and site-local fec0::/10
  return (first! & 0xff00) !== 0xff00; // multicast ff00::/8
};
