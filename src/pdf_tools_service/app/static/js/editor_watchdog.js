// Says so on the page when the editor fails to start, instead of leaving
// buttons that silently do nothing. A classic script, loaded before the editor
// module, so it runs in any browser and sees the module's load and start-up
// errors. editor.js sets body[data-editor-ready] on its last line.
(function () {
  "use strict";
  var problems = [];
  var here = document.currentScript && document.currentScript.src;
  var staticRoot = here ? here.replace(/js\/editor_watchdog\.js.*$/, "") : "";
  window.addEventListener("error", function (event) {
    var target = event.target;
    if (target && target !== window && (target.src || target.href)) {
      problems.push("could not load " + (target.src || target.href));
    } else if (event.message) {
      var where = event.filename ? " (" + event.filename.split("/").pop() + ":" + event.lineno + ")" : "";
      problems.push(event.message + where);
    }
  }, true);
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    problems.push(String((reason && reason.message) || reason));
  });
  // The files the editor cannot start without, fetched again to report what
  // this browser actually receives (a filter or proxy shows up here).
  function probe(path, done) {
    var request = new XMLHttpRequest();
    request.open("GET", staticRoot + path + "?probe=" + Date.now());
    request.onload = function () {
      done(path + ": HTTP " + request.status + ", " + (request.getResponseHeader("Content-Type") || "no type") +
        ", " + (request.responseText || "").length + " characters");
    };
    request.onerror = function () { done(path + ": request failed"); };
    request.send();
  }
  function report() {
    if (document.body.getAttribute("data-editor-ready") === "true") return;
    var files = ["js/editor.js", "js/pdf_runtime.js", "vendor/pdfjs/legacy/build/pdf.mjs"];
    var results = [];
    files.forEach(function (path) {
      probe(path, function (line) {
        results.push(line);
        if (results.length === files.length) show(results);
      });
    });
  }
  function show(results) {
    if (document.body.getAttribute("data-editor-ready") === "true") return;
    var box = document.createElement("div");
    box.id = "editor-start-failure";
    box.setAttribute("role", "alert");
    box.style.cssText = "position:relative;z-index:9999;padding:12px 16px;background:#fdecea;color:#611a15;" +
      "border-bottom:1px solid #e0a39c;font:14px/1.45 system-ui,sans-serif;white-space:pre-wrap";
    box.textContent = "The PDF Editor did not start in this browser, so Open PDF and drag-and-drop will not work.\n" +
      "Reload with Ctrl+Shift+R. If this message stays, send a screenshot of it to the administrator.\n\n" +
      "Browser: " + navigator.userAgent + "\n" +
      "Errors: " + (problems.length ? problems.join(" | ") : "none reported") + "\n" +
      "Files: " + results.join(" | ");
    document.body.insertBefore(box, document.body.firstChild);
  }
  window.addEventListener("load", function () { setTimeout(report, 4000); });
}());
