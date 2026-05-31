function bytesToB64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeData(obj) {
  const json = JSON.stringify(obj);
  return bytesToB64(new TextEncoder().encode(json));
}

export function decodeData(b64) {
  if (!b64) return { persons: [] };
  try {
    const json = new TextDecoder().decode(b64ToBytes(b64));
    const obj = JSON.parse(json);
    if (!obj || !Array.isArray(obj.persons)) return { persons: [] };
    return obj;
  } catch {
    return { persons: [] };
  }
}
