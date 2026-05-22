const START = new Date(Date.UTC(2026, 9, 1));
const END = new Date(Date.UTC(2027, 3, 30));
const ROUTES = ["North Bound", "South Bound", "Bluff", "Lyttelton/Timaru", "Unclassified"];
const STORAGE_KEY = "fiordland-calendar-rows-v1";
const UPLOAD_META_KEY = "fiordland-calendar-upload-meta-v1";
let sharedRowsRefreshInFlight = false;
let sharedUploadMetaRefreshInFlight = false;

const state = {
  rows: loadSavedRows() || window.FIORDLAND_INITIAL_ROWS || [],
  uploadMeta: loadUploadMeta(),
  search: "",
  month: "all",
  route: "all",
  warningsOpen: true,
  selectedSourceRow: null,
};

function loadSavedRows() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved).map(reviveRowDates);
  } catch {
    return null;
  }
}

function saveRows() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.rows));
  window.OtagoSharedStore?.save(STORAGE_KEY, serializeRows(state.rows)).catch((error) => {
    console.warn("Could not save Agent File rows to Supabase", error);
  });
  window.parent?.postMessage({ type: "agent-file-rows-updated" }, window.location.origin);
}

function loadUploadMeta() {
  try {
    return JSON.parse(localStorage.getItem(UPLOAD_META_KEY)) || { history: [] };
  } catch {
    return { history: [] };
  }
}

function saveUploadMeta() {
  localStorage.setItem(UPLOAD_META_KEY, JSON.stringify(state.uploadMeta));
  window.OtagoSharedStore?.save(UPLOAD_META_KEY, state.uploadMeta).catch((error) => {
    console.warn("Could not save upload record to Supabase", error);
  });
}

function logAgentEvent(title, details) {
  window.OtagoSharedStore?.logEvent?.({
    type: "agent",
    title,
    details,
  }).then(() => {
    window.parent?.postMessage({ type: "otago-event-log-updated" }, window.location.origin);
  }).catch((error) => {
    console.warn("Could not record Agent Data event", error);
  });
}

function recordUpload(file, rowCount) {
  const entry = {
    fileName: file.name,
    size: file.size,
    rowCount,
    uploadedAt: new Date().toISOString(),
  };
  state.uploadMeta = {
    lastUpload: entry,
    history: [entry, ...(state.uploadMeta.history || [])].slice(0, 20),
  };
  saveUploadMeta();
  renderUploadRecord();
}

function formatUploadTimestamp(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderUploadRecord() {
  const lastUpload = state.uploadMeta?.lastUpload;
  if (!lastUpload) {
    els.uploadRecord.textContent = "Last upload: none";
    els.uploadRecord.title = "";
    return;
  }

  const timestamp = formatUploadTimestamp(lastUpload.uploadedAt);
  els.uploadRecord.textContent = `Last upload: ${lastUpload.fileName} - ${timestamp}`;
  els.uploadRecord.title = `${lastUpload.rowCount || 0} vessel rows loaded`;
}

function resetSavedRows() {
  localStorage.removeItem(STORAGE_KEY);
  state.rows = window.FIORDLAND_INITIAL_ROWS || [];
  saveRows();
  logAgentEvent("Agent Data reset", "Vessel schedule reset to preloaded Pilotage 2026-27 sheet");
  els.fileStatus.textContent = "Reset to preloaded Pilotage 2026-27 sheet";
  render();
}

function reviveRowDates(row) {
  return {
    ...row,
    etaFiordland: row.etaFiordland ? new Date(row.etaFiordland) : null,
    etdFiordland: row.etdFiordland ? new Date(row.etdFiordland) : null,
    embarkDate: row.embarkDate ? new Date(row.embarkDate) : null,
    disembarkDate: row.disembarkDate ? new Date(row.disembarkDate) : null,
  };
}

function serializeRows(rows) {
  return JSON.parse(JSON.stringify(rows || []));
}

function rowsChanged(a, b) {
  return JSON.stringify(serializeRows(a)) !== JSON.stringify(serializeRows(b));
}

async function refreshSharedRows({ seedIfMissing = false } = {}) {
  if (sharedRowsRefreshInFlight || !window.OtagoSharedStore?.isReady) return;
  sharedRowsRefreshInFlight = true;

  try {
    const remote = await window.OtagoSharedStore.load(STORAGE_KEY);
    if (!remote.found) {
      if (seedIfMissing) await window.OtagoSharedStore.save(STORAGE_KEY, serializeRows(state.rows));
      return;
    }

    const nextRows = (remote.data || []).map(reviveRowDates);
    if (!rowsChanged(state.rows, nextRows)) return;

    state.rows = nextRows;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeRows(state.rows)));
    els.fileStatus.textContent = "Loaded shared vessel schedule";
    render();
  } catch (error) {
    console.warn("Could not load shared Agent File rows", error);
  } finally {
    sharedRowsRefreshInFlight = false;
  }
}

async function refreshSharedUploadMeta({ seedIfMissing = false } = {}) {
  if (sharedUploadMetaRefreshInFlight || !window.OtagoSharedStore?.isReady) return;
  sharedUploadMetaRefreshInFlight = true;

  try {
    const remote = await window.OtagoSharedStore.load(UPLOAD_META_KEY);
    if (!remote.found) {
      if (seedIfMissing) await window.OtagoSharedStore.save(UPLOAD_META_KEY, state.uploadMeta);
      return;
    }

    const nextMeta = remote.data || { history: [] };
    if (JSON.stringify(state.uploadMeta) === JSON.stringify(nextMeta)) return;

    state.uploadMeta = nextMeta;
    localStorage.setItem(UPLOAD_META_KEY, JSON.stringify(state.uploadMeta));
    renderUploadRecord();
  } catch (error) {
    console.warn("Could not load shared upload record", error);
  } finally {
    sharedUploadMetaRefreshInFlight = false;
  }
}

const els = {
  fileInput: document.querySelector("#fileInput"),
  resetButton: document.querySelector("#resetButton"),
  fileStatus: document.querySelector("#fileStatus"),
  uploadRecord: document.querySelector("#uploadRecord"),
  searchInput: document.querySelector("#searchInput"),
  monthFilter: document.querySelector("#monthFilter"),
  routeFilter: document.querySelector("#routeFilter"),
  totalShips: document.querySelector("#totalShips"),
  warningCount: document.querySelector("#warningCount"),
  busyDays: document.querySelector("#busyDays"),
  warningsToggle: document.querySelector("#warningsToggle"),
  warningsToggleText: document.querySelector("#warningsToggleText"),
  warningsPanel: document.querySelector("#warningsPanel"),
  editSection: document.querySelector("#editSection"),
  editTitle: document.querySelector("#editTitle"),
  editForm: document.querySelector("#editForm"),
  closeEditButton: document.querySelector("#closeEditButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  editVessel: document.querySelector("#editVessel"),
  editEtaDate: document.querySelector("#editEtaDate"),
  editEtaTime: document.querySelector("#editEtaTime"),
  editEtdDate: document.querySelector("#editEtdDate"),
  editEtdTime: document.querySelector("#editEtdTime"),
  editEmbark: document.querySelector("#editEmbark"),
  editEmbarkDate: document.querySelector("#editEmbarkDate"),
  editDisembark: document.querySelector("#editDisembark"),
  editDisembarkDate: document.querySelector("#editDisembarkDate"),
  editFromTo: document.querySelector("#editFromTo"),
  editStewartIsland: document.querySelector("#editStewartIsland"),
  editComments: document.querySelector("#editComments"),
  calendarBody: document.querySelector("#calendarBody"),
};

function excelSerialToDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKey(date) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatDate(date) {
  return date.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function weekday(date) {
  return date.toLocaleDateString("en-NZ", { weekday: "short", timeZone: "UTC" });
}

function norm(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function portText(row) {
  return [row.embark, row.disembark, row.fromTo, row.comments, row.stewartIsland].filter(Boolean).join(" | ");
}

function routePortText(row) {
  return [row.embark, row.disembark].filter(Boolean).join(" | ");
}

function hasStewartVisit(row) {
  return hasAny(norm(portText(row)), ["stewart", "stuart"]);
}

function isMilfordOnly(row) {
  const text = norm(portText(row));
  const embark = norm(row.embark);
  const disembark = norm(row.disembark);
  if (text.includes("milford only") || text.includes("milford sound only")) return true;
  if (row.etaFiordland && !embark && !disembark && !hasAny(text, ["stewart", "stuart", "bluff", "bench island", "beach island", "lyttelton", "timaru"])) return true;
  return embark.includes("milford") && disembark.includes("milford");
}

function categoryFor(row) {
  const embark = norm(row.embark);
  const routePorts = norm(routePortText(row));
  if (isMilfordOnly(row)) return "South Bound";
  if (hasAny(routePorts, ["bluff", "bench island", "beach island"])) return "Bluff";
  if (hasAny(embark, ["port chalmers", "portchalmer", "port chlamaers", "port otago", "dunedin"])) return "North Bound";
  if (embark.includes("milford")) return "South Bound";
  if (hasAny(routePorts, ["lyttelton", "timaru"])) return "Lyttelton/Timaru";
  return "Unclassified";
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function vesselLine(row) {
  const embark = displayPort(row.embark);
  const disembark = displayPort(row.disembark);
  const route = embark || disembark ? ` (${embark || "?"} -> ${disembark || "?"})` : "";
  return `${row.vessel}${route}`;
}

function displayPort(value) {
  const text = clean(value);
  const normalized = norm(text);
  if (!text) return "";
  if (hasAny(normalized, ["port chalmers", "portchalmer", "port chlamaers", "port otago"])) return "PC";
  if (normalized.includes("milford")) return "MLF";
  return text;
}

function makeCalendarDays() {
  const days = new Map();
  for (let d = new Date(START); d <= END; d = new Date(d.getTime() + 86400000)) {
    days.set(dateKey(d), {
      date: new Date(d),
      "North Bound": [],
      "South Bound": [],
      Bluff: [],
      "Lyttelton/Timaru": [],
      Unclassified: [],
      comments: [],
    });
  }
  return days;
}

function analyzeRows(rows) {
  const days = makeCalendarDays();
  const warnings = [];
  let included = 0;

  rows.forEach((row) => {
    const category = categoryFor(row);
    const calendarDate = calendarDateForRow(row, category);
    const key = dateKey(calendarDate);
    const issues = [];

    if (!row.etaFiordland) issues.push("Missing or unreadable Fiordland ETA date");
    if (calendarDate && !days.has(key)) issues.push(`${formatDate(calendarDate)} is outside the calendar window`);
    if (!isMilfordOnly(row) && !row.embark && !row.disembark) issues.push("Missing embark and disembark ports");
    if (!isMilfordOnly(row) && norm(row.embark) && norm(row.embark) === norm(row.disembark)) issues.push("Embark and disembark ports are the same");
    if (category === "Unclassified") issues.push("Unclassified or unallocated vessel");

    const embarkGap = daysBetween(row.etaFiordland, row.embarkDate);
    if (row.embarkDate && row.etaFiordland && Math.abs(embarkGap) > 5) {
      issues.push(`Embark date ${formatDate(row.embarkDate)} is ${Math.abs(embarkGap)} days from Fiordland ETA`);
    }

    const disembarkGap = daysBetween(row.etaFiordland, row.disembarkDate);
    if (row.disembarkDate && row.etaFiordland && Math.abs(disembarkGap) > 10) {
      issues.push(`Disembark date ${formatDate(row.disembarkDate)} is ${Math.abs(disembarkGap)} days from Fiordland ETA`);
    }

    if (issues.length && !row.acceptedWarning) {
      warnings.push({ row, category, issues });
    }

    if (days.has(key)) {
      const day = days.get(key);
      day[category].push(row);
      included += 1;
      const commentParts = [];
      if (row.comments) commentParts.push(row.comments);
      if (row.fromTo) commentParts.push(`From/To: ${row.fromTo}`);
      if (commentParts.length) day.comments.push(`${row.vessel}: ${commentParts.join("; ")}`);
    }
  });

  return { days: [...days.values()], warnings, included };
}

function calendarDateForRow(row, category) {
  if (category === "North Bound" && row.embarkDate) return row.embarkDate;
  if (category === "Bluff" && row.embarkDate) return row.embarkDate;
  if (category === "Lyttelton/Timaru" && row.embarkDate) return row.embarkDate;
  return row.etaFiordland;
}

function routeClass(route) {
  if (route === "North Bound") return "route-north";
  if (route === "South Bound") return "route-south";
  if (route === "Bluff") return "route-bluff";
  if (route === "Lyttelton/Timaru") return "route-lyttelton";
  return "route-unclassified";
}

function rowMatchesFilters(day) {
  const monthKey = `${day.date.getUTCFullYear()}-${String(day.date.getUTCMonth() + 1).padStart(2, "0")}`;
  if (state.month !== "all" && state.month !== monthKey) return false;

  const haystack = [
    formatDate(day.date),
    ...ROUTES.flatMap((route) => day[route].map((row) => `${row.vessel} ${row.embark} ${row.disembark} ${row.fromTo} ${row.comments}`)),
    ...day.comments,
  ].join(" ").toLowerCase();

  if (state.search && !haystack.includes(state.search.toLowerCase())) return false;
  if (state.route !== "all" && day[state.route].length === 0) return false;
  return true;
}

function renderShip(row, route) {
  const stewart = hasStewartVisit(row) ? `<span class="stewart-flag">Stewart Island</span>` : "";
  const milfordOnly = isMilfordOnly(row) ? `<span class="milford-only-flag">Milford Only</span>` : "";
  const selectedClass = String(state.selectedSourceRow) === String(row.sourceRow) ? " selected-ship" : "";
  return `<button class="ship-pill ${routeClass(route)}${selectedClass}" type="button" data-source-row="${escapeHtml(row.sourceRow)}">${escapeHtml(vesselLine(row))}${milfordOnly}${stewart}</button>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  const { days, warnings, included } = analyzeRows(state.rows);
  const visibleDays = days.filter(rowMatchesFilters);
  const busyDays = days.filter((day) => ROUTES.some((route) => day[route].length > 0)).length;
  const selectedRow = findRowBySourceRow(state.selectedSourceRow);

  els.totalShips.textContent = included;
  els.warningCount.textContent = warnings.length;
  els.busyDays.textContent = busyDays;

  els.warningsPanel.innerHTML = warnings.length
    ? warnings.map(({ row, category, issues }) => `
      <div class="warning-item" data-source-row="${escapeHtml(row.sourceRow)}">
        <div class="warning-title">
          <strong>${escapeHtml(row.vessel || `Source row ${row.sourceRow}`)}</strong>
          <span>${escapeHtml(category)}: ${escapeHtml(issues.join("; "))}</span>
        </div>
        <div class="warning-editor">
          <label>Fiordland date<input data-field="etaFiordland" type="date" value="${dateInputValue(row.etaFiordland)}" /></label>
          <label>Embark<input data-field="embark" type="text" value="${escapeHtml(row.embark)}" /></label>
          <label>Disembark<input data-field="disembark" type="text" value="${escapeHtml(row.disembark)}" /></label>
          <label>Embark date<input data-field="embarkDate" type="date" value="${dateInputValue(row.embarkDate)}" /></label>
          <label>Disembark date<input data-field="disembarkDate" type="date" value="${dateInputValue(row.disembarkDate)}" /></label>
          <div class="warning-actions">
            <button type="button" data-action="apply-warning">Update</button>
            <button type="button" data-action="accept-warning">Accept</button>
          </div>
        </div>
      </div>
    `).join("")
    : `<div class="warning-item"><strong>Clear</strong><span>No warnings found.</span></div>`;

  els.calendarBody.innerHTML = visibleDays.map((day) => {
    const isEmpty = !ROUTES.some((route) => day[route].length) && !day.comments.length;
    return `
      <tr class="${isEmpty ? "empty-day" : ""}">
        <td>${formatDate(day.date)}<span class="date-sub">${weekday(day.date)}</span></td>
        ${ROUTES.map((route) => `<td>${day[route].map((row) => renderShip(row, route)).join("")}</td>`).join("")}
        <td class="comments-cell">${escapeHtml(day.comments.join("\n\n"))}</td>
      </tr>
    `;
  }).join("");

  renderEditPanel(selectedRow);
}

function renderEditPanel(row) {
  els.editSection.classList.toggle("hidden", !row);
  if (!row) return;

  els.editTitle.textContent = `Edit ${row.vessel || `source row ${row.sourceRow}`}`;
  els.editVessel.value = row.vessel || "";
  els.editEtaDate.value = dateInputValue(row.etaFiordland);
  els.editEtaTime.value = timeInputValue(row.etaTime);
  els.editEtdDate.value = dateInputValue(row.etdFiordland);
  els.editEtdTime.value = timeInputValue(row.etdTime);
  els.editEmbark.value = row.embark || "";
  els.editEmbarkDate.value = dateInputValue(row.embarkDate);
  els.editDisembark.value = row.disembark || "";
  els.editDisembarkDate.value = dateInputValue(row.disembarkDate);
  els.editFromTo.value = row.fromTo || "";
  els.editStewartIsland.value = row.stewartIsland || "";
  els.editComments.value = row.comments || "";
}

function dateInputValue(date) {
  return date ? dateKey(date) : "";
}

function dateFromInput(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function timeInputValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    const minutes = Math.round(value * 24 * 60);
    return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const text = clean(value);
  const match = text.match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function timeFromInput(value) {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
  return (hours * 60 + minutes) / 1440;
}

function buildMonthFilter() {
  const formatter = new Intl.DateTimeFormat("en-NZ", { month: "long", year: "numeric", timeZone: "UTC" });
  const seen = new Set();
  const options = [`<option value="all">All months</option>`];
  for (let d = new Date(START); d <= END; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!seen.has(value)) {
      options.push(`<option value="${value}">${formatter.format(d)}</option>`);
      seen.add(value);
    }
  }
  els.monthFilter.innerHTML = options.join("");
}

function headerMap(headers) {
  const map = new Map();
  headers.forEach((header, index) => {
    const key = norm(header).replace(/[^a-z0-9]+/g, "");
    if (key) map.set(key, index);
  });
  return map;
}

function headerValue(row, map, names, fallbackIndex = null) {
  for (const name of names) {
    const index = map.get(name.replace(/[^a-z0-9]+/g, "").toLowerCase());
    if (index !== undefined) return row[index];
  }
  return fallbackIndex === null ? "" : row[fallbackIndex];
}

function cleanHeaderValue(row, map, names, fallbackIndex = null) {
  return clean(headerValue(row, map, names, fallbackIndex));
}

function dateHeaderValue(row, map, names, fallbackIndex = null) {
  return excelSerialToDate(headerValue(row, map, names, fallbackIndex));
}

function normalizeWorkbookRows(matrix) {
  const headerIndex = matrix.findIndex((row) => row.some((cell) => norm(cell) === "vessel"));
  if (headerIndex < 0) throw new Error("Could not find the VESSEL header row.");
  const headers = matrix[headerIndex];
  const map = headerMap(headers);

  return matrix.slice(headerIndex + 1).map((r, idx) => ({
    sourceRow: headerIndex + idx + 2,
    no: headerValue(r, map, ["no"], 0),
    status: cleanHeaderValue(r, map, ["status"]),
    vessel: cleanHeaderValue(r, map, ["vessel"], 1),
    etaFiordland: dateHeaderValue(r, map, ["milforddate", "fiordlanddate", "etafiordland"], 2),
    etaTime: headerValue(r, map, ["etatime"], 3),
    etdFiordland: dateHeaderValue(r, map, ["etdfiordland"], 4),
    etdTime: headerValue(r, map, ["etdtime"], 5),
    embark: cleanHeaderValue(r, map, ["embarkplace", "embark"], 6),
    embarkDate: dateHeaderValue(r, map, ["embarkdate"], 7),
    disembark: cleanHeaderValue(r, map, ["disembarkplace", "disembark"], 8),
    disembarkDate: dateHeaderValue(r, map, ["disembarkdate"], 9),
    fromTo: cleanHeaderValue(r, map, ["fromto"], 10),
    comments: cleanHeaderValue(r, map, ["comments"], 11),
    stewartIsland: cleanHeaderValue(r, map, ["stewartisland", "stewardisland"], 12),
    company: cleanHeaderValue(r, map, ["company"], 13),
    service: cleanHeaderValue(r, map, ["service"]),
    pilot: cleanHeaderValue(r, map, ["pilot"]),
    trainee: cleanHeaderValue(r, map, ["trainee"]),
    lecturer: cleanHeaderValue(r, map, ["lecturer"]),
    driver: cleanHeaderValue(r, map, ["driver"]),
    mhDays: cleanHeaderValue(r, map, ["mhdays"]),
    launch: cleanHeaderValue(r, map, ["launch"]),
    actions: cleanHeaderValue(r, map, ["actions"]),
  })).filter((row) => row.vessel || row.etaFiordland || row.embark || row.disembark || row.comments);
}

async function handleUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true, defval: "" });
    state.rows = normalizeWorkbookRows(matrix);
    saveRows();
    recordUpload(file, state.rows.length);
    logAgentEvent("Agent Data uploaded", `${file.name} loaded with ${state.rows.length} vessel row${state.rows.length === 1 ? "" : "s"}`);
    els.fileStatus.textContent = `${file.name} loaded`;
    render();
  } catch (error) {
    els.fileStatus.textContent = error.message || "Upload failed";
  }
}

function findRowBySourceRow(sourceRow) {
  return state.rows.find((row) => String(row.sourceRow) === String(sourceRow));
}

function handleWarningClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const item = button.closest(".warning-item");
  const row = findRowBySourceRow(item?.dataset.sourceRow);
  if (!row) return;

  if (button.dataset.action === "accept-warning") {
    row.acceptedWarning = true;
    saveRows();
    logAgentEvent("Agent warning accepted", `${row.vessel || "Vessel"} source row ${row.sourceRow}`);
    render();
    return;
  }

  item.querySelectorAll("[data-field]").forEach((input) => {
    const field = input.dataset.field;
    if (["etaFiordland", "embarkDate", "disembarkDate"].includes(field)) {
      row[field] = dateFromInput(input.value);
    } else {
      row[field] = clean(input.value);
    }
  });
  row.acceptedWarning = false;
  saveRows();
  logAgentEvent("Agent warning updated", `${row.vessel || "Vessel"} source row ${row.sourceRow}`);
  render();
}

function openEditorForRow(sourceRow) {
  state.selectedSourceRow = sourceRow;
  render();
  els.editSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditor() {
  state.selectedSourceRow = null;
  render();
}

function handleCalendarClick(event) {
  const shipButton = event.target.closest(".ship-pill[data-source-row]");
  if (!shipButton) return;
  openEditorForRow(shipButton.dataset.sourceRow);
}

function handleEditSubmit(event) {
  event.preventDefault();
  const row = findRowBySourceRow(state.selectedSourceRow);
  if (!row) return;

  row.vessel = clean(els.editVessel.value);
  row.etaFiordland = dateFromInput(els.editEtaDate.value);
  row.etaTime = timeFromInput(els.editEtaTime.value);
  row.etdFiordland = dateFromInput(els.editEtdDate.value);
  row.etdTime = timeFromInput(els.editEtdTime.value);
  row.embark = clean(els.editEmbark.value);
  row.embarkDate = dateFromInput(els.editEmbarkDate.value);
  row.disembark = clean(els.editDisembark.value);
  row.disembarkDate = dateFromInput(els.editDisembarkDate.value);
  row.fromTo = clean(els.editFromTo.value);
  row.stewartIsland = clean(els.editStewartIsland.value);
  row.comments = clean(els.editComments.value);
  row.acceptedWarning = false;

  saveRows();
  state.selectedSourceRow = null;
  els.fileStatus.textContent = `${row.vessel || "Vessel"} updated`;
  logAgentEvent("Agent vessel updated", `${row.vessel || "Vessel"} source row ${row.sourceRow}`);
  render();
}

els.fileInput.addEventListener("change", handleUpload);
els.resetButton.addEventListener("click", resetSavedRows);
els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});
els.monthFilter.addEventListener("change", (event) => {
  state.month = event.target.value;
  render();
});
els.routeFilter.addEventListener("change", (event) => {
  state.route = event.target.value;
  render();
});
els.warningsToggle.addEventListener("click", () => {
  state.warningsOpen = !state.warningsOpen;
  els.warningsPanel.classList.toggle("hidden", !state.warningsOpen);
  els.warningsToggle.setAttribute("aria-expanded", String(state.warningsOpen));
  els.warningsToggleText.textContent = state.warningsOpen ? "Hide" : "Show";
});
els.warningsPanel.addEventListener("click", handleWarningClick);
els.calendarBody.addEventListener("click", handleCalendarClick);
els.editForm.addEventListener("submit", handleEditSubmit);
els.closeEditButton.addEventListener("click", closeEditor);
els.cancelEditButton.addEventListener("click", closeEditor);

buildMonthFilter();
render();
renderUploadRecord();
refreshSharedRows({ seedIfMissing: true });
refreshSharedUploadMeta({ seedIfMissing: true });
setInterval(refreshSharedRows, 5000);
setInterval(refreshSharedUploadMeta, 5000);
window.addEventListener("focus", () => {
  refreshSharedRows();
  refreshSharedUploadMeta();
});
