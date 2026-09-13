import { stationState, stationLabel } from "./czml.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderChips(stations) {
  document.getElementById("chips").innerHTML = stations.map(station => {
    const state = stationState(station);
    return `<span class="chip" title="${esc(stationLabel(station, station.band))}">
      <svg class="dish st-${state.label}"><use href="#dishglyph"/></svg>
      <b>${esc(station.band)}</b> <span class="st">#${station.id} \u00b7 ${state.label}</span>
    </span>`;
  }).join("");
}

function rowHtml(row) {
  const today = new Date().toISOString().slice(0, 10);
  const day = row.start.slice(0, 10) === today ? "" :
    `<span class="meta">${row.start.slice(5, 10)} </span>`;
  return `
  <tr data-id="${row.id}" data-start="${Date.parse(row.start)}" data-end="${Date.parse(row.end)}">
    <td style="width:16px"><svg class="dish ${esc(row.status)}"><use href="#dishglyph"/></svg></td>
    <td><span class="sat">${esc(row.sat)}</span><span class="band">${esc(row.band)}</span><br>
        <span class="meta">${esc(row.transmitter || "")}</span>
        <div class="prog"></div></td>
    <td class="meta" style="width:92px">${day}${row.start.slice(11, 16)}&ndash;${row.end.slice(11, 16)}Z<br>
        ${row.max_altitude != null ? Math.round(row.max_altitude) + "&deg; el" : ""}</td>
    <td style="width:56px"><a href="${esc(row.url)}" target="_blank"
        onclick="event.stopPropagation()">${row.id}</a></td>
  </tr>`;
}

let rowCount = 0;

export function renderTable(rows, onSelect) {
  document.getElementById("obs").innerHTML = rows.length
    ? rows.map(rowHtml).join("")
    : "<tr><td class='empty'>no observations in window</td></tr>";
  for (const tr of document.querySelectorAll("#obs tr[data-id]")) {
    tr.onclick = () => onSelect(tr.dataset.id);
  }
  rowCount = rows.length;
  labelToggle();
}

// Narrow layouts show only the pass under way; the rest are one tap away.
function labelToggle() {
  const button = document.getElementById("expand");
  const open = document.getElementById("panel").classList.contains("open");
  button.textContent = open ? "show current only" : `show all passes (${rowCount})`;
}

export function wireToggle() {
  document.getElementById("expand").addEventListener("click", () => {
    document.getElementById("panel").classList.toggle("open");
    labelToggle();
  });
  labelToggle();
}

function ageText(seconds) {
  if (seconds == null) return "no data yet";
  if (seconds < 90) return "updated just now";
  if (seconds < 5400) return `updated ${Math.round(seconds / 60)}m ago`;
  return `updated ${Math.round(seconds / 3600)}h ago`;
}

export function showAge(seconds, { stale = false, error = null, paused = false } = {}) {
  const el = document.getElementById("age");
  if (error) {
    el.className = "err";
    el.textContent = `${ageText(seconds)} \u00b7 ${error.split(":")[0]}`;
    return;
  }
  if (paused) {
    el.className = "stale";
    el.textContent = `${ageText(seconds)} \u00b7 paused, tap to resume`;
    return;
  }
  el.className = stale ? "stale" : "";
  el.textContent = ageText(seconds) + (stale ? " \u00b7 stale" : "");
}

let lastRunning = null;

// Driven by the Cesium clock rather than the fetch cadence, so rows turn
// yellow the second a pass starts and scrubbing the timeline moves all of it.
export function paint(timeMs) {
  document.getElementById("clock").textContent =
    new Date(timeMs).toISOString().slice(11, 19) + "Z";

  let running = null;
  let upcoming = null;
  for (const tr of document.querySelectorAll("#obs tr[data-id]")) {
    const start = +tr.dataset.start, end = +tr.dataset.end;
    const now = timeMs >= start && timeMs <= end;
    tr.classList.toggle("now", now);
    tr.classList.toggle("done", timeMs > end);
    tr.classList.remove("next");
    if (now) {
      running = tr;
      tr.querySelector(".prog").style.width =
        (100 * (timeMs - start) / (end - start)).toFixed(1) + "%";
    }
    // rows are start-ordered, so the first one not yet over is the next pass
    if (!upcoming && timeMs <= end) upcoming = tr;
  }
  if (upcoming) upcoming.classList.add("next");

  if (running && running.dataset.id !== lastRunning) {
    lastRunning = running.dataset.id;
    running.scrollIntoView({ block: "nearest" });
  }
}
