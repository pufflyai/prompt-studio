const encoder = new TextEncoder();

export const deriveDocumentNamingKey = async (secret: string) => {
  const bytes = Uint8Array.from(atob(secret.replaceAll("-", "+").replaceAll("_", "/")), (byte) => byte.charCodeAt(0));
  const root = await crypto.subtle.importKey("raw", bytes, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: encoder.encode("pstdio-sync document id v1") },
    root,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
};

export const syncDocumentId = async (naming: CryptoKey, name: string) => {
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", naming, encoder.encode(name)));
  return btoa(String.fromCharCode(...digest.subarray(0, 16)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};
