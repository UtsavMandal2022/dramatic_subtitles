// Native captions are hidden purely via CSS (styles/hide-native-captions.css),
// gated on a class on <html>. This file just owns toggling that class, so a
// freshly recreated caption node is hidden automatically with zero JS work.
(function () {
  const NS = window.__dramaticSubs;
  const C = NS.constants;

  NS.captionHider = {
    hide() {
      document.documentElement.classList.add(C.ACTIVE_HTML_CLASS);
    },
    show() {
      document.documentElement.classList.remove(C.ACTIVE_HTML_CLASS);
    },
  };
})();
