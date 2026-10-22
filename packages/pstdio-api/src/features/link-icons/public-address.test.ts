import { expect, test } from "bun:test";
import { isPublicAddress } from "./public-address";

test("public internet addresses are allowed", () => {
  for (const address of [
    "140.82.121.4",
    "8.8.8.8",
    "100.128.0.1",
    "172.32.0.1",
    "2606:4700::6810:84e5",
    "64:ff9b::808:808",
    "2002:808:808::1",
    "::ffff:8.8.8.8",
  ])
    expect(isPublicAddress(address)).toBe(true);
});

test("local network addresses are refused", () => {
  for (const address of [
    "0.0.0.0",
    "0.1.2.3",
    "127.0.0.1",
    "127.255.255.254",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "100.127.255.255",
    "224.0.0.1",
    "239.255.255.250",
    "::",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "fe80::1%en0",
    "febf::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "0:0:0:0:0:ffff:192.168.0.1",
    "::127.0.0.1",
    "::7f00:1",
    "::ffff:0:7f00:1",
    "64:ff9b::a00:1",
    "64:ff9b::7f00:1",
    "64:ff9b:1::1",
    "2002:7f00:1::1",
    "fec0::1",
  ])
    expect(isPublicAddress(address)).toBe(false);
});

test("text that is not an IP address is refused", () => {
  for (const address of ["", "localhost", "999.1.1.1", "1.2.3", "::g"]) expect(isPublicAddress(address)).toBe(false);
});
