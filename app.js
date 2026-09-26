import {
  API_URL, LIMA, SERVER, meta, intensity,
  ymdInTZ, hmInTZ, eventsForDay, groupByDay, isLive, nextEvent, monthMatrix,
} from "./logic.js";

const $ = (s) => document.querySelector(s);
const state = {
  events: [],
  tz: LIMA,
  y: 0, m: 0,
  sel: "",
  hidden: new Set(),
  lastUpdated: null,
};

const tzLabel = () => (state.tz === SERVER ? "hora del servidor (UTC+3)" : "hora de Lima (UTC-5)");
const todayYmd = () => ymdInTZ(new Date(), state.tz);

async function load() {
  $("#subtitle").textContent = "Cargando eventos…";
  try {
    const res = await fetch(API_URL, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    state.events = (json.data || []).filter(e => e.enabled !== false);
    state.lastUpdated = new Date();
    if (!state.sel) {
      state.sel = todayYmd();
      const d = new Date();
      state.y = d.getFullYear();
      state.m = d.getMonth() + 1;
    }
    renderAll();
  } catch (err) {
    $("#subtitle").textContent = "⚠ No se pudieron cargar los eventos";
    $("#day-events").innerHTML =
      `<div class="empty">Error: ${err.message}<br><br>
        <button class="ghost" id="retry" style="width:auto;padding:0 14px">Reintentar</button></div>`;
    const r = $("#retry");
    if (r) r.onclick = load;
  }
}

function renderAll() {
  $("#subtitle").textContent = `Horarios en ${tzLabel()}`;
  renderCalendar();
  renderLegend();
  renderDay();
  $("#updated").textContent = state.lastUpdated
    ? `actualizado ${hmInTZ(state.lastUpdated, state.tz)}` : "";
}

function renderCalendar() {
  const label = new Date(Date.UTC(state.y, state.m - 1, 1))
    .toLocaleDateString("es-PE", { month: "long", year: "numeric", timeZone: "UTC" });
  $("#month-label").textContent = label;

  const tz = state.tz;
  const matrix = monthMatrix(state.y, state.m);
  const grid = $("#grid");
  grid.innerHTML = "";
  const t = todayYmd();

  for (const week of matrix) {
    for (const ymd of week) {
      const inMonth = ymd.slice(0, 7) === `${state.y}-${String(state.m).padStart(2, "0")}`;
      const dayEvents = state.events.length
        ? eventsForDay(state.events, ymd, tz).filter(e => !state.hidden.has(e.eventIndex))
        : [];
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell" + (inMonth ? "" : " out") + (ymd === t ? " today" : "") + (ymd === state.sel ? " sel" : "");
      const types = [...new Set(dayEvents.map(e => e.eventIndex))].slice(0, 4);
      cell.innerHTML =
        `<span class="num">${+ymd.slice(-2)}</span>` +
        `<span class="dots">${types.map(idx => `<i class="dot" style="background:${meta(idx).color}"></i>`).join("")}</span>`;
      cell.onclick = () => {
        state.sel = ymd;
        renderCalendar();
        renderDay();
        if (window.innerWidth < 900) $("#day-label").scrollIntoView({ behavior: "smooth", block: "start" });
      };
      grid.appendChild(cell);
    }
  }
}

function usedTypes() {
  const seen = new Set();
  for (const e of state.events) seen.add(e.eventIndex);
  return [...seen].sort((a, b) => meta(a).name.localeCompare(meta(b).name));
}

function renderLegend() {
  $("#legend").innerHTML = usedTypes().map(idx =>
    `<span class="li"><i class="dot" style="background:${meta(idx).color}"></i>${meta(idx).icon} ${meta(idx).name}</span>`
  ).join("");
}

function renderDay() {
  const tz = state.tz;
  const now = new Date();

  const dayLabel = new Date(state.sel + "T12:00:00Z")
    .toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  $("#day-label").textContent = dayLabel;

  // filtros
  const filters = $("#filters");
  filters.innerHTML = "";
  for (const idx of usedTypes()) {
    const on = !state.hidden.has(idx);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (on ? " on" : "");
    chip.textContent = `${meta(idx).icon} ${meta(idx).name}`;
    if (on) {
      chip.style.background = `color-mix(in srgb,${meta(idx).color} 20%,transparent)`;
      chip.style.borderColor = meta(idx).color;
    }
    chip.onclick = () => {
      on ? state.hidden.add(idx) : state.hidden.delete(idx);
      renderCalendar();
      renderDay();
    };
    filters.appendChild(chip);
  }

  // próximo evento
  const nx = nextEvent(state.events, tz, now);
  const nev = $("#next-event");
  if (nx) {
    const mins = Math.max(0, Math.round((nx.start - now.getTime()) / 60000));
    const when = mins < 60 ? `en ${mins} min` : `en ${Math.floor(mins / 60)}h ${mins % 60}m`;
    nev.innerHTML =
      `<span class="big">Próximo: ${meta(nx.event.eventIndex).icon} ${meta(nx.event.eventIndex).name}</span>
       · ${hmInTZ(new Date(nx.start), tz)} <span style="color:var(--muted)">(${when})</span>`;
    nev.style.display = "block";
  } else {
    nev.style.display = "none";
  }

  // lista del día
  const evs = eventsForDay(state.events, state.sel, tz).filter(e => !state.hidden.has(e.eventIndex));
  const box = $("#day-events");
  box.innerHTML = "";
  if (!evs.length) {
    box.innerHTML = `<div class="empty">Sin eventos este día 🍃</div>`;
    return;
  }

  const groups = groupByDay(evs, tz);
  for (const g of groups) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.textContent = `🕐 ${g.slot}`;
    box.appendChild(slot);

    const block = document.createElement("div");
    block.className = "day-events-block";
    for (const e of g.items) {
      const m = meta(e.eventIndex);
      const b = intensity(e);
      const live = isLive(e, now);
      const div = document.createElement("div");
      div.className = "ev";
      div.style.setProperty("--c", m.color);
      div.innerHTML =
        `<span class="ic">${m.icon}</span>
         <div class="body">
           <div class="nm">${m.name}${live ? ` <span class="live"><span class="p"></span>EN VIVO</span>` : ""}</div>
           <div class="tm">${hmInTZ(new Date(Date.parse(e.startTime)), tz)}–${hmInTZ(new Date(Date.parse(e.endTime)), tz)}</div>
         </div>
         ${b ? `<span class="badge">${b}</span>` : ""}`;
      block.appendChild(div);
    }
    box.appendChild(block);
  }
}

// controles
$("#prev").onclick = () => { state.m--; if (state.m < 1) { state.m = 12; state.y--; } renderCalendar(); };
$("#next").onclick = () => { state.m++; if (state.m > 12) { state.m = 1; state.y++; } renderCalendar(); };
$("#refresh").onclick = load;
document.querySelectorAll(".tz button").forEach(btn => {
  btn.onclick = () => {
    state.tz = btn.dataset.tz;
    state.sel = state.sel || todayYmd();
    renderAll();
    document.querySelectorAll(".tz button").forEach(b => b.classList.toggle("active", b === btn));
  };
});

load();
setInterval(renderDay, 60_000);
setInterval(load, 30 * 60_000);
