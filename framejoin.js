// framejoin.js：按处理预算处理事件，用尽就连着载压账；收尾不限预算清账。
import { isHex, readOf } from "./frame.js";

const DEFAULT_CODES = {
  bad_hex_code: "E_BAD_HEX",
  empty_code: "E_EMPTY",
  short_code: "E_SHORT",
  event_error_code: "E_BAD_EVENT"
};

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function codeOf(spec, name) {
  const codes = spec && spec.codes ? spec.codes : spec;
  return (codes && codes[name]) || DEFAULT_CODES[name];
}

function cloneState(state) {
  const src = state || {};
  return {
    frames: Array.isArray(src.frames) ? src.frames.map(function (row) { return [row[0], row[1]]; }) : [],
    buffer: typeof src.buffer === "string" ? src.buffer : "",
    ledger: Array.isArray(src.ledger) ? src.ledger.map(function (row) { return row.slice(0, 3); }) : [],
    applied: Array.isArray(src.applied) ? src.applied.slice() : []
  };
}

// 事件带 id 就按 id 去重（多个 frame 不会撞），否则退化为种类加载荷的内容键。
function keyOf(kind, text, id) {
  if (id !== undefined && id !== null) return "id:" + String(id);
  return "c:" + kind + "\u0000" + (kind === "frame" ? "" : (text || ""));
}

// 全部事件先过结构与十六进制校验，与预算无关，任一不合法直接抛错。
function validate(events, spec) {
  events.forEach(function (event) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      fail(codeOf(spec, "event_error_code"));
    }
    if (event.kind !== "feed" && event.kind !== "frame") {
      fail(codeOf(spec, "event_error_code"));
    }
    if (event.kind === "feed" && !isHex(event.text)) {
      fail(codeOf(spec, "bad_hex_code"));
    }
  });
}

// 处理队列里的一项（账上旧账或新事件同构）：追加缓冲或按首字节切帧。
function handle(item, state, spec) {
  if (item.kind === "feed") {
    state.buffer += item.text || "";
    return;
  }
  if (state.buffer === "") fail(codeOf(spec, "empty_code"));
  const frame = readOf(state.buffer);
  if (frame === null) fail(codeOf(spec, "short_code"));
  state.frames.push([frame.length, frame.payload]);
  state.buffer = frame.rest;
}

export function step(spec) {
  spec = spec || {};
  const state = cloneState(spec.state);
  const events = Array.isArray(spec.events) ? spec.events : [];
  validate(events, spec);

  const ledgerBefore = state.ledger.length;
  let budget = Number(spec.budget);
  if (!Number.isFinite(budget) || budget < 0) budget = 0;

  // 账上旧账排在前面，随后是没处理过也没压过账的新事件。
  const queue = state.ledger.map(function (row) {
    return { kind: row[0], text: row[1], queued: true, key: row[2] };
  });
  const ledgerKeys = {};
  state.ledger.forEach(function (row) { if (row[2] !== undefined) ledgerKeys[row[2]] = true; });
  const applied = {};
  state.applied.forEach(function (key) { applied[key] = true; });

  events.forEach(function (event) {
    const key = keyOf(event.kind, event.text, event.id);
    if (applied[key] || ledgerKeys[key]) return;
    queue.push({ kind: event.kind, text: event.text, key: key });
  });

  let served = 0;
  let pushed = 0;
  state.ledger = [];

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i];
    if (served >= budget) {
      // 预算用尽：余下的连着载压账（内部带上键，对外仍是种类加载荷）。
      state.ledger.push([item.kind, item.kind === "frame" ? "" : (item.text || ""), item.key]);
      if (!item.queued) {
        applied[item.key] = true;
        state.applied.push(item.key);
        pushed += 1;
      }
      continue;
    }
    handle(item, state, spec);
    served += 1;
    if (!item.queued) {
      applied[item.key] = true;
      state.applied.push(item.key);
    }
  }

  const ledgerNow = state.ledger.length;
  const ledgerView = state.ledger.map(function (row) { return [row[0], row[1]]; });
  return {
    state: state,
    served: served,
    ledger_before: ledgerNow,
    ledger: ledgerView,
    judged: served + pushed,
    judged_bound: ledgerBefore + events.length
  };
}

export function close(spec) {
  spec = spec || {};
  const state = cloneState(spec.state);
  let catchup = 0;
  while (state.ledger.length > 0) {
    const row = state.ledger.shift();
    handle({ kind: row[0], text: row[1] }, state, spec);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
