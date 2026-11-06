(function () {
  // ShinyFam: Haendleranfrage-Formulare fest einschraenken (Dennis, 26.10.2026):
  //   - "TCG Börse Rheinberg ": nur 3 Meter + nur Tag 2 (Sonntag), beides gesperrt
  //   - "Grav Island CardsCon" (Wesel): nur Tag 2 (Sonntag), kein Tag 1 -- Meterwahl frei lassen
  //   - alle anderen Events (z.B. Duelmen): komplett unveraendert lassen
  //
  // Anker: jede Event-Karte ist ein <article aria-label="Event: <Titel>">
  // (siehe Bundle, bo()-Komponente) -- eindeutiger als Text-Suche im Baum,
  // verhindert das Uebergreifen auf Nachbar-Events wie beim ersten Versuch.

  var RULES = [
    { title: "TCG Börse Rheinberg", meters: "3m", days: "tag2" },
    { title: "Grav Island CardsCon", days: "tag2" } // Meter bleibt frei waehlbar
  ];

  function ruleForArticle(article) {
    var label = article.getAttribute("aria-label") || "";
    for (var i = 0; i < RULES.length; i++) {
      if (label.indexOf("Event: " + RULES[i].title) === 0) return RULES[i];
    }
    return null;
  }

  function reactSetValue(el, value) {
    var proto = window.HTMLSelectElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyMeters(select, fixedValue) {
    if (select.dataset.rbLocked === fixedValue) return;
    Array.from(select.options).forEach(function (opt) {
      if (opt.value !== fixedValue) opt.remove();
    });
    reactSetValue(select, fixedValue);
    select.disabled = true;
    select.dataset.rbLocked = fixedValue;
  }

  function applyDays(select, fixedValue) {
    if (select.dataset.rbLocked === fixedValue) return;
    Array.from(select.options).forEach(function (opt) {
      if (opt.value !== fixedValue) opt.remove();
    });
    reactSetValue(select, fixedValue);
    select.disabled = true;
    select.dataset.rbLocked = fixedValue;
  }

  function processArticle(article) {
    var rule = ruleForArticle(article);
    if (!rule) return;
    if (rule.meters) {
      var metersSelect = article.querySelector("#inquiry-meters");
      if (metersSelect) applyMeters(metersSelect, rule.meters);
    }
    if (rule.days) {
      var daysSelect = article.querySelector("#inquiry-days");
      if (daysSelect) applyDays(daysSelect, rule.days);
    }
  }

  function scan(root) {
    if (root.matches && root.matches('article[aria-label^="Event: "]')) {
      processArticle(root);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll('article[aria-label^="Event: "]').forEach(processArticle);
    }
  }

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        scan(node);
      });
    });
  });

  function start() {
    scan(document);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
