const tabButtons = document.querySelectorAll(".tool-tab");
const tabPanels = document.querySelectorAll(".tab-panel");

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    tabButtons.forEach((tabButton) => {
      tabButton.setAttribute("aria-selected", String(tabButton === button));
    });

    tabPanels.forEach((panel) => {
      const isActive = panel.id === button.getAttribute("aria-controls");
      panel.hidden = !isActive;
      panel.classList.toggle("active", isActive);
    });
  });
});
