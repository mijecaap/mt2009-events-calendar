import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  intensity, meta, ymdInTZ, hmInTZ, zonedToUtc,
  eventsForDay, groupByDay, isLive, nextEvent, monthMatrix, LIMA, ARG,
} from "./logic.js";

const FIX = JSON.parse(readFileSync(new URL("./fixtures/events.sample.json", import.meta.url))).data;

test("intensity: EXP usa value0 como %", () => {
  assert.equal(intensity({ eventIndex: "EVENT_TYPE_EXP", value0: 80 }), "+80%");
});
test("intensity: Rueda 1% sin estrella", () => {
  assert.equal(intensity({ eventIndex: "EVENT_TYPE_WHEEL_FORTUNE_EVENT", value3: 1 }), "1%");
});
test("intensity: Rueda 2% lleva estrella (NO 3%)", () => {
  assert.equal(intensity({ eventIndex: "EVENT_TYPE_WHEEL_FORTUNE_EVENT", value3: 2 }), "2% ★");
});
test("intensity: Pesca doble = x2", () => {
  assert.equal(intensity({ eventIndex: "EVENT_TYPE_DOUBLE_FISHING", value0: 100 }), "x2");
});
test("intensity: Doble Loot usa value3 con + y SIN estrella", () => {
  assert.equal(intensity({ eventIndex: "EVENT_TYPE_DOUBLE_METIN_LOOT_EVENT", value3: 40 }), "+40%");
});
test("intensity: Bonus usa value1", () => {
  assert.equal(intensity({ eventIndex: "EVENT_TYPE_BONUS_EVENT", value1: 1500 }), "+1500");
});
test("meta: nombre desconocido se humaniza", () => {
  assert.equal(meta("EVENT_TYPE_NEW_THING").name, "new thing");
});
test("ymdInTZ: 03:00Z es 25/09 en Lima y 26/09 en Argentina", () => {
  const d = new Date("2026-09-26T03:00:00.000Z");
  assert.equal(ymdInTZ(d, LIMA), "2026-09-25");
  assert.equal(ymdInTZ(d, ARG), "2026-09-26");
});
test("hmInTZ: 11:00Z = 06:00 Lima y 08:00 Argentina", () => {
  const d = new Date("2026-09-26T11:00:00.000Z");
  assert.equal(hmInTZ(d, LIMA), "06:00");
  assert.equal(hmInTZ(d, ARG), "08:00");
});
test("zonedToUtc: medianoche Lima = 05:00Z y Argentina = 03:00Z", () => {
  assert.equal(new Date(zonedToUtc("2026-09-26", LIMA)).toISOString(), "2026-09-26T05:00:00.000Z");
  assert.equal(new Date(zonedToUtc("2026-09-26", ARG)).toISOString(), "2026-09-26T03:00:00.000Z");
});
test("eventsForDay: incluye solape de medianoche y excluye deshabilitados", () => {
  const evs = eventsForDay(FIX, "2026-09-26", LIMA);
  const idxs = evs.map(e => e.id);
  assert.ok(idxs.includes(6), "slot 23:00Z debe entrar por solape");
  assert.ok(!idxs.includes(7), "evento disabled no debe aparecer");
});
test("groupByDay: ordena por hora de inicio", () => {
  const groups = groupByDay(eventsForDay(FIX, "2026-09-26", LIMA), LIMA);
  for (let i = 1; i < groups.length; i++) {
    assert.ok(groups[i].start >= groups[i - 1].start);
  }
});
test("isLive/nextEvent coherentes", () => {
  const now = new Date("2026-09-26T04:10:00.000Z");
  assert.equal(isLive(FIX.find(e => e.id === 4), now), true);
  const n = nextEvent(FIX, LIMA, now);
  assert.equal(n.event.id, 2);
});
test("monthMatrix: semana L(unes)-D(omingo), 6x7", () => {
  const m = monthMatrix(2026, 9);
  assert.equal(m.length, 6);
  assert.equal(m[0].length, 7);
});
