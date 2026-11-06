(function () {
  // ShinyFam Admin: Zwei Checkboxen "Tag 1 sperren (ausverkauft)" / "Tag 2
  // sperren (ausverkauft)" im Event-Bearbeiten-Formular, direkt unter der
  // bestehenden "Tag 1 ist nur buchbar, wenn auch Tag 2 mitgebucht wird"-
  // Checkbox. Steuert das Feld allowed_attendance_days (JSON-Array:
  // "tag1"/"tag2"/"beide", NULL = alle erlaubt, [] = Event komplett
  // gesperrt) ueber den eigenen Endpunkt PATCH /api/events/:id/attendance,
  // unabhaengig vom normalen Speichern-Button -- Aenderung wirkt sofort bei
  // Checkbox-Klick, kein Submit noetig (Dennis, 28.10.2026).
  //
  // Technik: kein Zugriff auf den React-Quellcode (nur gebautes Bundle
  // vorhanden), daher eigenstaendige DOM-Injektion nach dem bestehenden
  // Checkbox-Textanker "ist nur buchbar, wenn auch" -- selbes Muster wie
  // rheinberg-lock.js / soldout-overlay.js.

  var TOKEN_KEY = "shinyfam-admin-token";
  var eventsCache = null;
  var eventsCacheAt = 0;

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  async function loadEvents(force) {
    var now = Date.now();
    if (!force && eventsCache && now - eventsCacheAt < 4000) return eventsCache;
    var token = getToken();
    if (!token) return null;
    try {
      var res = await fetch("/api/events", { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) return null;
      eventsCache = await res.json();
      eventsCacheAt = now;
      return eventsCache;
    } catch (e) {
      return null;
    }
  }

  function currentTitleInput() {
    return document.getElementById("evt-title");
  }

  async function currentEditingEvent() {
    var titleInput = currentTitleInput();
    if (!titleInput) return null;
    var title = (titleInput.value || "").trim();
    if (!title) return null;
    var events = await loadEvents(false);
    if (!events) return null;
    return events.find(function (ev) { return (ev.title || "").trim() === title; }) || null;
  }

  async function patchAttendance(id, allowedAttendanceDays) {
    var token = getToken();
    if (!token) return false;
    try {
      var res = await fetch("/api/events/" + encodeURIComponent(id) + "/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ allowedAttendanceDays: allowedAttendanceDays }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  function findScheduleSection() {
    var labels = document.querySelectorAll("label.admin-label, label");
    for (var i = 0; i < labels.length; i++) {
      if ((labels[i].textContent || "").indexOf("Zeitplan (mehrtägig") !== -1) {
        // Die Zeitplan-Sektion ist der naechste Vorfahre, der auch die
        // Tag-Zeilen (Inputs mit placeholder "z.B. Samstag") enthaelt.
        var node = labels[i];
        for (var depth = 0; depth < 6 && node; depth++) {
          if (node.querySelector && node.querySelector('input[placeholder="z.B. Samstag"]')) return node;
          node = node.parentElement;
        }
        return labels[i].parentElement;
      }
    }
    return null;
  }

  function findExistingCheckboxLabel(section) {
    var labels = section.querySelectorAll("label");
    for (var i = 0; i < labels.length; i++) {
      if ((labels[i].textContent || "").indexOf("ist nur buchbar, wenn auch") !== -1) {
        return labels[i];
      }
    }
    return null;
  }

  function dayLabels(section) {
    var inputs = section.querySelectorAll('input[placeholder="z.B. Samstag"]');
    return {
      tag1: inputs[0] && inputs[0].value ? inputs[0].value : "Tag 1",
      tag2: inputs[1] && inputs[1].value ? inputs[1].value : "Tag 2",
    };
  }

  function makeCheckboxRow(labelText) {
    var row = document.createElement("label");
    row.className = "flex items-center gap-2 mt-2 text-sm text-secondary cursor-pointer shinyfam-attendance-row";
    var input = document.createElement("input");
    input.type = "checkbox";
    input.className = "w-4 h-4";
    var span = document.createElement("span");
    span.textContent = labelText;
    row.appendChild(input);
    row.appendChild(span);
    return { row: row, input: input, span: span };
  }

  function statusLine() {
    var el = document.createElement("div");
    el.className = "text-xs text-muted mt-1 shinyfam-attendance-status";
    el.style.minHeight = "1.2em";
    return el;
  }

  // Leitet aus dem aktuellen allowedAttendanceDays-Array (oder null) ab,
  // ob Tag 1 bzw. Tag 2 als Einzeltag gesperrt sein sollen. null (alle
  // erlaubt) und ["tag1","tag2","beide"] (explizit alle) zaehlen beide als
  // "nichts gesperrt".
  function deriveLockState(allowed) {
    if (allowed === null || allowed === undefined) return { tag1Locked: false, tag2Locked: false };
    return {
      tag1Locked: allowed.indexOf("tag1") === -1,
      tag2Locked: allowed.indexOf("tag2") === -1,
    };
  }

  // Baut das neue allowedAttendanceDays-Array aus dem gewuenschten Sperr-
  // Zustand. "Beide" bleibt immer erlaubt, ausser beide Tage sind gesperrt
  // (dann ist das Event komplett dicht -- leeres Array).
  function buildAllowedDays(tag1Locked, tag2Locked) {
    if (tag1Locked && tag2Locked) return [];
    var days = ["beide"];
    if (!tag1Locked) days.push("tag1");
    if (!tag2Locked) days.push("tag2");
    return days;
  }

  function setupForSection(section) {
    if (section.dataset.attendanceLockInit) return;

    var anchorLabel = findExistingCheckboxLabel(section);
    var insertAfter = anchorLabel || section.lastElementChild;
    if (!insertAfter) return;

    section.dataset.attendanceLockInit = "1";

    var wrap = document.createElement("div");
    wrap.className = "shinyfam-attendance-lock mt-1";

    var intro = document.createElement("p");
    intro.className = "text-xs text-muted mt-3 mb-1";
    intro.textContent = "Einzeltage sperren (z. B. bei Ausverkauf):";
    wrap.appendChild(intro);

    var labels = dayLabels(section);
    var row1 = makeCheckboxRow((labels.tag1 || "Tag 1") + " ausverkauft/sperren");
    var row2 = makeCheckboxRow((labels.tag2 || "Tag 2") + " ausverkauft/sperren");
    var status = statusLine();
    var hint = document.createElement("p");
    hint.className = "text-xs text-muted mt-1";
    hint.textContent = "Sind beide gesperrt, ist das gesamte Event ausverkauft. Ist nur ein Tag gesperrt, bleibt „Beide Tage“ weiterhin buchbar.";

    wrap.appendChild(row1.row);
    wrap.appendChild(row2.row);
    wrap.appendChild(hint);
    wrap.appendChild(status);

    insertAfter.insertAdjacentElement("afterend", wrap);

    async function refreshLabelsAndState() {
      var ev = await currentEditingEvent();
      var dl = dayLabels(section);
      row1.span.textContent = (dl.tag1 || "Tag 1") + " ausverkauft/sperren";
      row2.span.textContent = (dl.tag2 || "Tag 2") + " ausverkauft/sperren";
      if (!ev) {
        row1.input.disabled = true;
        row2.input.disabled = true;
        status.textContent = "Erst speichern, bevor Tage gesperrt werden können (neues Event).";
        return null;
      }
      row1.input.disabled = false;
      row2.input.disabled = false;
      var state = deriveLockState(ev.allowedAttendanceDays);
      row1.input.checked = state.tag1Locked;
      row2.input.checked = state.tag2Locked;
      status.textContent = "";
      return ev;
    }

    async function onToggle() {
      var ev = await currentEditingEvent();
      if (!ev) return;
      status.textContent = "Speichere …";
      var allowed = buildAllowedDays(row1.input.checked, row2.input.checked);
      var ok = await patchAttendance(ev.id, allowed);
      status.textContent = ok ? "Gespeichert." : "Fehler beim Speichern – bitte erneut versuchen.";
      if (ok) {
        await loadEvents(true);
        setTimeout(function () { status.textContent = ""; }, 2500);
      }
    }

    row1.input.addEventListener("change", onToggle);
    row2.input.addEventListener("change", onToggle);

    refreshLabelsAndState();

    // Beim Wechsel des bearbeiteten Events (Titel-Feld aendert sich durch
    // Klick auf "Bearbeiten" bei einem anderen Event) Zustand neu laden.
    var titleInput = currentTitleInput();
    if (titleInput && !titleInput.dataset.attendanceLockWatched) {
      titleInput.dataset.attendanceLockWatched = "1";
      var lastValue = titleInput.value;
      setInterval(function () {
        if (titleInput.value !== lastValue) {
          lastValue = titleInput.value;
          refreshLabelsAndState();
        }
      }, 400);
    }
  }

  function scan() {
    var section = findScheduleSection();
    if (section) setupForSection(section);
  }

  var observer = new MutationObserver(function () {
    scan();
  });

  function start() {
    scan();
    observer.observe(document.body, { childList: true, subtree: true });
    [300, 800, 1500, 3000].forEach(function (delay) {
      setTimeout(scan, delay);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
