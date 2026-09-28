// frame.js：十六进制校验与取帧
// 缓冲是一串偶数个十六进制字符；首字节（两个字符）是载荷长度，
// 后面跟同样数目的字节。字符凑不齐一帧就给空，整段留在缓冲里。

export function isHex(text) {
  return typeof text === "string" && text.length % 2 === 0 && /^[0-9a-f]*$/.test(text);
}

export function readOf(buffer) {
  if (typeof buffer !== "string" || buffer.length < 2) return null;
  const length = parseInt(buffer.slice(0, 2), 16);
  if (!Number.isInteger(length) || length < 0) return null;
  const need = 2 + length * 2;
  if (buffer.length < need) return null;
  return {
    length: length,
    payload: buffer.slice(2, need),
    rest: buffer.slice(need)
  };
}
