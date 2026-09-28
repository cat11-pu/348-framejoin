// framejoin.js：按处理预算处理并留账
import { isHex, readOf } from "./frame.js";

function fault(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function codes(spec) {
  return {
    badEvent: spec.event_error_code || "E_BAD_EVENT",
    badHex: spec.bad_hex_code || "E_BAD_HEX",
    empty: spec.empty_code || "E_EMPTY",
    short: spec.short_code || "E_SHORT"
  };
}

function normalizeState(raw) {
  const state = raw || {};
  return {
    frames: (state.frames || []).map(function (row) { return [row[0], row[1]]; }),
    buffer: typeof state.buffer === "string" ? state.buffer : "",
    ledger: (state.ledger || []).map(function (row) { return row.slice(); }),
    applied: (state.applied || []).slice()
  };
}

// 先校验全部事件，与预算无关：结构不合法报 E_BAD_EVENT，载荷不是偶数个十六进制字符报 E_BAD_HEX
function validate(events, errs) {
  events.forEach(function (event) {
    if (!event || typeof event !== "object") throw fault(errs.badEvent, "bad event");
    if (event.kind === "frame") return;
    if (event.kind === "feed" && typeof event.text === "string") {
      if (!isHex(event.text)) throw fault(errs.badHex, "bad hex");
      return;
    }
    throw fault(errs.badEvent, "bad event");
  });
}

function applyEntry(state, entry, errs) {
  if (entry[0] === "feed") {
    state.buffer += entry[1];
    return;
  }
  if (state.buffer.length === 0) throw fault(errs.empty, "empty buffer");
  const frame = readOf(state.buffer);
  if (!frame) throw fault(errs.short, "short frame");
  state.frames.push([frame.length, frame.payload]);
  state.buffer = frame.rest;
}

export function step(spec) {
  const errs = codes(spec);
  const events = spec.events || [];
  validate(events, errs);
  const state = normalizeState(spec.state);
  let budget = typeof spec.budget === "number" ? spec.budget : 0;
  let served = 0;
  const pending = state.ledger;
  state.ledger = [];
  // 先清旧账再办新事件，同一份预算共用；预算用尽的事件连着载荷压账
  for (const entry of pending) {
    if (budget <= 0) { state.ledger.push(entry); continue; }
    applyEntry(state, entry, errs);
    if (entry.length > 2) state.applied.push(entry[2]);
    budget -= 1;
    served += 1;
  }
  events.forEach(function (event, index) {
    const id = event.id !== undefined ? event.id : index;
    if (state.applied.indexOf(id) !== -1) return;
    if (budget <= 0) {
      state.ledger.push(event.kind === "feed" ? ["feed", event.text, id] : ["frame", "", id]);
      return;
    }
    applyEntry(state, event.kind === "feed" ? ["feed", event.text] : ["frame", ""], errs);
    state.applied.push(id);
    budget -= 1;
    served += 1;
  });
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return [row[0], row[1]]; }),
    judged: served,
    judged_bound: events.length + pending.length
  };
}

export function close(spec) {
  const errs = codes(spec);
  const state = normalizeState(spec.state);
  const pending = state.ledger;
  state.ledger = [];
  let catchup = 0;
  for (const entry of pending) {
    applyEntry(state, entry, errs);
    if (entry.length > 2) state.applied.push(entry[2]);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
