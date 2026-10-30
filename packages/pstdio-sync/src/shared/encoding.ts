export const encodeBytes = (bytes: Uint8Array) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
export const decodeBytes = (encoded: string) => Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
export const encodeText = (text: string) => encodeBytes(new TextEncoder().encode(text));
export const decodeText = (encoded: string) => new TextDecoder().decode(decodeBytes(encoded));
