(() => {
  function moveTabsIntoHeader() {
    const tabs = document.querySelector(".md-tabs");
    const headerInner = document.querySelector(".md-header__inner");
    if (!tabs || !headerInner) return;

    if (tabs.dataset.movedToHeader === "1") return;

    const search = headerInner.querySelector(".md-search");
    if (search) {
      headerInner.insertBefore(tabs, search);
    } else {
      headerInner.appendChild(tabs);
    }

    tabs.dataset.movedToHeader = "1";
  }

  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(moveTabsIntoHeader);
  } else {
    document.addEventListener("DOMContentLoaded", moveTabsIntoHeader);
  }

  new MutationObserver(moveTabsIntoHeader).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
