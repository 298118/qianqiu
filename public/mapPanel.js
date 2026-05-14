// public/mapPanel.js
(function() {
  const panel = document.getElementById("map-panel");
  const canvasContainer = document.getElementById("map-canvas");
  const uiLayer = document.getElementById("map-ui-layer");
  
  let renderer = null;
  let currentView = null;
  let activeTooltip = null;

  function destroyRenderer() {
    if (renderer && typeof renderer.destroy === "function") {
      renderer.destroy();
    }
    renderer = null;
    canvasContainer.innerHTML = "";
  }

  function clearDOM() {
    uiLayer.innerHTML = "";
    activeTooltip = null;
  }
  
  function createFallback() {
    destroyRenderer();
    clearDOM();
    const fallback = document.createElement("div");
    fallback.className = "map-fallback";
    fallback.textContent = "舆图组件暂缺或发生故障。";
    uiLayer.appendChild(fallback);
  }
  
  function createWaiting() {
    destroyRenderer();
    clearDOM();
    const waiting = document.createElement("div");
    waiting.className = "map-fallback";
    waiting.textContent = "舆图资料待生成...";
    uiLayer.appendChild(waiting);
  }

  function idsFromMapRef(value) {
    if (!value || typeof value !== "string") return [];
    const pieces = value.split(":").filter(Boolean);
    return [value, pieces[pieces.length - 1]].filter(Boolean);
  }

  function cardCandidateIds(ref = {}) {
    const ids = new Set();
    idsFromMapRef(ref.mapEntityRef).forEach((id) => ids.add(id));
    idsFromMapRef(ref.sourceRef).forEach((id) => ids.add(id));
    (Array.isArray(ref.sourceRefs) ? ref.sourceRefs : []).forEach((sourceRef) => {
      idsFromMapRef(sourceRef).forEach((id) => ids.add(id));
    });
    return ids;
  }

  function findInformationPanelCard(ref) {
    const ids = cardCandidateIds(ref);
    if (!ids.size) return null;
    return Array.from(document.querySelectorAll("article[data-entity-id], article[data-event-id]"))
      .find((card) => ids.has(card.dataset.entityId) || ids.has(card.dataset.eventId)) || null;
  }

  function highlightInformationCard(card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.style.transition = "box-shadow 0.3s";
    card.style.boxShadow = "0 0 0 2px var(--jade)";
    setTimeout(() => { card.style.boxShadow = ""; }, 2000);
  }

  function activateInformationPanelPage(page) {
    const panel = page.closest("#information-panel");
    const tabId = page.dataset.tabId || page.id.replace("-panel", "");
    if (!panel || !tabId) return;
    panel.dataset.activeTab = tabId;
    panel.querySelectorAll(".information-tab").forEach((tab) => {
      const selected = tab.dataset.tabId === tabId;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
    });
    panel.querySelectorAll(".information-panel-page").forEach((candidate) => {
      candidate.hidden = candidate !== page;
    });
  }

  function focusInformationPanelCard(ref) {
    const card = findInformationPanelCard(ref);
    if (!card) return;
    const page = card.closest(".information-panel-page");
    if (page && page.id && page.hidden) {
      activateInformationPanelPage(page);
    }
    requestAnimationFrame(() => {
      const freshCard = findInformationPanelCard(ref);
      if (freshCard && freshCard.isConnected) highlightInformationCard(freshCard);
    });
  }

  function handleClickRef(ref, pos) {
     if (activeTooltip) activeTooltip.remove();
     
     activeTooltip = document.createElement("div");
     activeTooltip.className = "map-tooltip";
     activeTooltip.style.left = `${pos.x}px`;
     activeTooltip.style.top = `${pos.y}px`;
     
     const title = document.createElement("strong");
     title.textContent = ref.label;
     activeTooltip.appendChild(title);
     
     if (ref.summary) {
       const desc = document.createElement("p");
       desc.textContent = ref.summary;
       activeTooltip.appendChild(desc);
     }
     
     if (findInformationPanelCard(ref)) {
       const btnLink = document.createElement("button");
       btnLink.className = "map-action-draft map-information-link";
       btnLink.textContent = "查阅局势簿";
       btnLink.onclick = (e) => {
         e.stopPropagation();
         focusInformationPanelCard(ref);
       };
       activeTooltip.appendChild(btnLink);
     }

     if (ref.actionDraftRefs && ref.actionDraftRefs.length > 0 && currentView && currentView.actionDrafts) {
       ref.actionDraftRefs.forEach(draftId => {
         const draft = currentView.actionDrafts[draftId];
         if (draft) {
            const btn = document.createElement("button");
            btn.className = "map-action-draft";
            btn.textContent = draft.label || "行动草拟";
            btn.onclick = (e) => {
              e.stopPropagation();
              const input = document.getElementById("action-input");
              if (input) {
                input.value = draft.actionText;
                input.focus();
              }
              activeTooltip.remove();
              activeTooltip = null;
            };
            activeTooltip.appendChild(btn);
         }
       });
     }
     
     uiLayer.appendChild(activeTooltip);
     
     // Boundary detection
     const rect = activeTooltip.getBoundingClientRect();
     const containerRect = uiLayer.getBoundingClientRect();
     if (rect.left < containerRect.left) {
       activeTooltip.style.left = `${pos.x + (containerRect.left - rect.left)}px`;
     } else if (rect.right > containerRect.right) {
       activeTooltip.style.left = `${pos.x - (rect.right - containerRect.right)}px`;
     }
     if (rect.top < containerRect.top) {
       activeTooltip.style.top = `${pos.y + (containerRect.top - rect.top) + 24}px`; // Push below if cuts off top
     }
  }

  function handleRenderLabel(ref, pos) {
    if (!ref.label) return;
    const label = document.createElement("div");
    label.className = "map-label";
    label.textContent = ref.label;
    label.style.left = `${pos.x}px`;
    label.style.top = `${pos.y}px`;
    uiLayer.appendChild(label);
  }

  window.QianqiuMapRenderer = {
    update(mapRuntimeView) {
      currentView = mapRuntimeView;
      panel.hidden = false;

      if (!mapRuntimeView || mapRuntimeView.schemaVersion !== 1) {
        createWaiting();
        return;
      }
      
      if (!window.PIXI || !window.MapRenderer) {
        createFallback();
        return;
      }
      
      if (!renderer) {
        try {
          renderer = new window.MapRenderer(canvasContainer, {
            onRenderLabel: (ref, pos) => handleRenderLabel(ref, pos),
            onClickRef: (ref, pos) => handleClickRef(ref, pos),
            onNeedsUpdate: () => {
               if (currentView) this.update(currentView);
            }
          });
          
          uiLayer.addEventListener('click', (e) => {
            if (e.target === uiLayer && activeTooltip) {
               activeTooltip.remove();
               activeTooltip = null;
            }
          });
        } catch (e) {
          console.error("MapRenderer init failed", e);
          createFallback();
          return;
        }
      }
      
      clearDOM();
      try {
        renderer.update(mapRuntimeView);
      } catch (e) {
        console.error("MapRenderer update failed", e);
      }
    },
    showWaitingState() {
      panel.hidden = false;
      createWaiting();
    },
    getDebugState() {
      return {
        hasRenderer: Boolean(renderer),
        hidden: Boolean(panel.hidden),
        labelCount: uiLayer.querySelectorAll(".map-label").length,
        fallbackText: uiLayer.querySelector(".map-fallback")?.textContent || "",
        tooltipVisible: Boolean(activeTooltip),
        renderer: renderer && typeof renderer.getDebugState === "function"
          ? renderer.getDebugState()
          : null
      };
    }
  };

})();
