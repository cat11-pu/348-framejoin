// frame.js：十六进制校验与取帧
export function isHex(text) {
  return typeof text === "string" && text.length % 2 === 0 && /^[0-9a-f]*$/.test(text);
}

export function readOf(buffer) {
  if (!isHex(buffer) || buffer.length < 2) return null;
  const length = parseInt(buffer.slice(0, 2), 16);
  const need = 2 + length * 2;
  if (buffer.length < need) return null;
  return { length: length, payload: buffer.slice(2, need), rest: buffer.slice(need) };
}
