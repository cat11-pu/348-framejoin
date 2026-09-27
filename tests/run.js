import assert from "node:assert";
import { isHex, readOf } from "../frame.js";
import { step, close } from "../framejoin.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { frames: [], buffer: "", ledger: [], applied: [] },
  events: [{ id: 1, kind: "feed", text: "0461626364" }],
  bad_hex_code: "E_BAD_HEX", empty_code: "E_EMPTY",
  short_code: "E_SHORT", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("isHex returns a boolean", () => {
  assert.strictEqual(typeof isHex("04"), "boolean");
});

check("readOf returns a frame or nothing", () => {
  const got = readOf("0461626364");
  assert.ok(got === null || typeof got === "object");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
