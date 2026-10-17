import { createPrivateKey, X509Certificate } from "node:crypto";

export const validFixtureTls = (input: { host: string; certificate: string; key: string }[], now = Date.now()) => {
  try {
    return (
      input.length === 2 &&
      input.every(({ host, certificate, key }) => {
        const parsed = new X509Certificate(certificate);
        return (
          parsed.checkHost(host) === host &&
          parsed.checkPrivateKey(createPrivateKey(key)) &&
          Date.parse(parsed.validFrom) <= now &&
          now < Date.parse(parsed.validTo)
        );
      })
    );
  } catch {
    return false;
  }
};
