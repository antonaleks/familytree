function b64(str) {
  let bin = '';
  for (const byte of new TextEncoder().encode(str)) bin += String.fromCharCode(byte);
  return btoa(bin);
}
export function encodePassword(plain) { return b64(plain); }
export function checkPassword(input, storedB64) { return b64(input) === storedB64; }
