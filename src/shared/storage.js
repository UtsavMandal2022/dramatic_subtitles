// Thin Promise wrappers around chrome.storage.local, shared by content script
// and popup so both use the same key and defaults.
(function () {
  const NS = (window.__dramaticSubs = window.__dramaticSubs || {});
  const KEY = NS.constants
    ? NS.constants.STORAGE_KEY_ENABLED
    : 'dramaticSubsEnabled';
  const DEFAULT_ENABLED = NS.constants ? NS.constants.DEFAULT_ENABLED : true;

  NS.storage = {
    getEnabled() {
      return new Promise((resolve) => {
        chrome.storage.local.get([KEY], (result) => {
          resolve(result[KEY] ?? DEFAULT_ENABLED);
        });
      });
    },

    setEnabled(enabled) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [KEY]: !!enabled }, resolve);
      });
    },

    onEnabledChanged(callback) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && KEY in changes) {
          callback(changes[KEY].newValue ?? DEFAULT_ENABLED);
        }
      });
    },
  };
})();
