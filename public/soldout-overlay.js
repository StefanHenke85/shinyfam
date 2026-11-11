(function () {
  // ShinyFam: Zeigt ein "SOLD OUT"-Badge ueber JEDEM Vorkommen eines als
  // ausverkauft markierten Events auf der Seite -- die Event-Karte in der
  // Liste, das "Naechstes Event"-Popup beim Seitenaufruf, und die grosse
  // Detail-Sektion auf der Startseite. Das Backend sperrt Haendleranfragen
  // fuer solche Events ohnehin serverseitig ueber allowed_attendance_days
  // = []; dies hier ist nur die sichtbare Anzeige dazu. Generisch nach
  // Event-Titel im sichtbaren Text gesucht statt an einzelne, moeglicherweise
  // bei jedem Rebuild wechselnde CSS-Klassen gebunden, damit es robust auch
  // Stellen trifft, die nicht als <article aria-label="Event: ..."> markiert
  // sind (Dennis, 28.10.2026 -- erster Versuch traf nur die Karten-Liste,
  // nicht Popup/Detailsektion).

  // Im Admin-Bereich KEIN Overlay: dort verdeckte es Listen und Formulare
  // (Stefan, 11.11.2026). Steuerung dort per Checkbox "Haendler ausverkauft".
  if (location.pathname.indexOf("/admin") === 0) return;

  var soldOutTitles = [];
  var fetched = false;

  async function loadSoldOutTitles() {
    if (fetched) return;
    fetched = true;
    try {
      var res = await fetch("/api/events");
      var events = await res.json();
      soldOutTitles = events
        .filter(function (ev) { return ev.soldOutLabel; })
        .map(function (ev) { return { title: (ev.title || "").trim(), label: ev.soldOutLabel }; });
    } catch (e) {
      // Ohne Daten keine Badges zeigen, nicht die Seite kaputt machen.
    }
  }

  function makeBadge(label) {
    var badge = document.createElement("div");
    badge.className = "shinyfam-soldout-badge";
    badge.setAttribute("data-shinyfam-soldout", "1");
    badge.style.cssText = [
      "position:absolute",
      "inset:0",
      "z-index:9999",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "pointer-events:none",
      "background:rgba(10,4,4,0.55)",
      "border-radius:inherit",
    ].join(";");

    var ribbon = document.createElement("div");
    ribbon.textContent = label;
    ribbon.style.cssText = [
      "background:rgba(20,8,8,0.92)",
      "color:#fff",
      "font-weight:800",
      "font-size:clamp(0.7rem, 3.2vw, 1.3rem)",
      "letter-spacing:0.04em",
      "padding:0.5em 1em",
      "border:3px solid #ef4444",
      "border-radius:0.5em",
      "transform:rotate(-8deg)",
      "box-shadow:0 4px 18px rgba(0,0,0,0.6)",
      "text-transform:uppercase",
      "font-family:inherit",
      "white-space:normal",
      "text-align:center",
      "max-width:85%",
      "line-height:1.25",
    ].join(";");

    badge.appendChild(ribbon);
    return badge;
  }

  function disableHandlerButtons(container) {
    var candidates = container.querySelectorAll("button, a");
    candidates.forEach(function (el) {
      if (el.dataset.soldOutDisabled) return;
      var text = (el.textContent || "");
      if (/Als Händler anfragen/i.test(text)) {
        el.dataset.soldOutDisabled = "1";
        if (el.tagName === "BUTTON") el.disabled = true;
        el.style.opacity = "0.5";
        el.style.pointerEvents = "none";
        el.style.cursor = "not-allowed";
        el.textContent = "Ausverkauft – keine Anfragen möglich";
      }
    });
  }

  // Findet den kleinsten sinnvollen "Karten"-Container um ein Text-Element
  // herum, auf dem ein Badge positioniert werden kann (braucht position:
  // relative/absolute als Elternelement, daher ein Container mit messbarer
  // Groesse, keine reine <span>-Textzeile).
  function findCardContainer(el) {
    var node = el;
    for (var i = 0; i < 8 && node; i++) {
      if (node.offsetWidth > 150 && node.offsetHeight > 80) return node;
      node = node.parentElement;
    }
    return el.parentElement || el;
  }

  function markTitleOccurrences(title, label) {
    if (!title) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.indexOf(title) !== -1) {
        textNodes.push(node);
      }
    }
    textNodes.forEach(function (textNode) {
      var container = findCardContainer(textNode.parentElement);
      if (!container || container.dataset.soldOutApplied === label) return;
      container.dataset.soldOutApplied = label;
      var computedPosition = window.getComputedStyle(container).position;
      if (computedPosition === "static") container.style.position = "relative";
      container.appendChild(makeBadge(label));
      container.style.filter = "grayscale(0.35)";

      // Fuer die Button-Deaktivierung breiter suchen als nur im Badge-
      // Container: das naechstgelegene <article> (Karten-Liste) oder sonst
      // der Badge-Container selbst (Popup/Detailsektion haben kein article).
      var articleAncestor = textNode.parentElement && textNode.parentElement.closest
        ? textNode.parentElement.closest("article")
        : null;
      disableHandlerButtons(articleAncestor || container);
    });
  }

  function scan() {
    soldOutTitles.forEach(function (entry) {
      markTitleOccurrences(entry.title, entry.label);
    });
  }

  var observer = new MutationObserver(function () {
    scan();
  });

  async function start() {
    await loadSoldOutTitles();
    if (soldOutTitles.length === 0) return;
    scan();
    observer.observe(document.body, { childList: true, subtree: true });

    // React rendert Inhalte teils schon, bevor unser eigener Request zurueck
    // ist, und aktualisiert danach manchmal nur bestehende Knoten statt neue
    // einzufuegen (MutationObserver meldet dann nichts mehr). Daher zusaetzlich
    // mehrfach aktiv nachscannen, um Race Conditions robust abzufangen --
    // auch fuer Popups, die erst mit Verzoegerung erscheinen.
    [300, 800, 1500, 3000, 6000, 10000].forEach(function (delay) {
      setTimeout(scan, delay);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
