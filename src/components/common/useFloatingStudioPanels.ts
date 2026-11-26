import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { persistActiveScene } from "../../core/scenePersistence";
import { useEditorStore } from "../../core/store/editorStore";

export type FloatingStudioPanel = "timeline" | "properties";
const titles: Record<FloatingStudioPanel, string> = { timeline: "Timeline", properties: "Propriedades" };
const panelNames = Object.keys(titles) as FloatingStudioPanel[];

function closePanelWindow(name: FloatingStudioPanel, popup: Window) {
  const closePopup = () => { if (!popup.closed) popup.close(); };
  void invoke<boolean>("close_studio_panel", { panel: name })
    .then((closed) => { if (!closed) closePopup(); }, closePopup);
}

function makeHost() {
  const host = document.createElement("div");
  host.className = "h-full min-h-0";
  return host;
}

function mountPopup(popup: Window, panel: FloatingStudioPanel, host: HTMLElement, onClose: () => void) {
  const page = popup.document;
  if (page.body.dataset.studioFloatingPanel) return;
  for (const stylesheet of document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style')) {
    const copy = stylesheet.cloneNode(true) as HTMLElement;
    if (stylesheet instanceof HTMLLinkElement) copy.setAttribute("href", stylesheet.href);
    page.head.append(copy);
  }
  const applyTheme = () => {
    for (const attribute of ["class", "style", "data-theme", "data-rds-theme"] as const) {
      const value = document.documentElement.getAttribute(attribute);
      if (value === null) page.documentElement.removeAttribute(attribute);
      else page.documentElement.setAttribute(attribute, value);
    }
  };
  const theme = new MutationObserver(applyTheme);
  theme.observe(document.documentElement, { attributes: true });
  applyTheme();
  page.title = titles[panel] + " · RetroDev Studio";
  page.body.dataset.studioFloatingPanel = panel;
  page.body.className = "flex h-screen min-h-0 flex-col overflow-hidden rds-surface-panel";

  const dock = page.createElement("button");
  dock.type = "button";
  dock.className = "ml-auto self-end rounded border px-3 py-1 m-2 text-xs";
  dock.textContent = "Reencaixar " + titles[panel];
  dock.dataset.testid = "floating-studio-dock";
  dock.addEventListener("click", onClose);
  page.body.append(dock);
  const body = page.createElement("div");
  body.className = "flex-1 min-h-0 overflow-hidden";
  body.append(host);
  page.body.append(body);
  popup.addEventListener("pagehide", () => { theme.disconnect(); onClose(); }, { once: true });
  page.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (!event.ctrlKey && !event.metaKey) return;
    const key = event.key.toLowerCase();
    const state = useEditorStore.getState();
    if (key === "s" && state.activeProjectDir) {
      event.preventDefault();
      (page.activeElement as HTMLElement | null)?.blur();
      void persistActiveScene(state.activeProjectDir, "Painel", undefined, { onlyIfChanged: true });
      return;
    }
    const editable = page.activeElement?.closest("input,textarea,select,[contenteditable=true]");
    if (!editable && (key === "z" || key === "y")) {
      event.preventDefault();
      if (key === "y" || event.shiftKey) state.redo();
      else state.undo();
    }
  });
  dock.focus();
}

export function useFloatingStudioPanels(reportFailure: (reason: string) => void) {
  const [hosts] = useState(() => ({ timeline: makeHost(), properties: makeHost() }));
  const docks = useRef<Partial<Record<FloatingStudioPanel, HTMLElement>>>({});
  const windows = useRef<Partial<Record<FloatingStudioPanel, Window>>>({});
  const [open, setOpen] = useState<Partial<Record<FloatingStudioPanel, boolean>>>({});

  const dockPanel = useCallback((name: FloatingStudioPanel) => {
    const popup = windows.current[name];
    if (!popup) return;
    delete windows.current[name];
    const destination = docks.current[name];
    if (destination) destination.append(hosts[name]);
    else hosts[name].remove();
    closePanelWindow(name, popup);
    setOpen((current) => ({ ...current, [name]: false }));
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-testid="float-' + name + '"]')?.focus());
  }, [hosts]);

  const floatPanel = useCallback((name: FloatingStudioPanel) => {
    if (windows.current[name] && !windows.current[name]?.closed) {
      windows.current[name]?.focus();
      return;
    }
    const url = new URL("/src/studio-panel.html", window.location.href);
    url.searchParams.set("panel", name);
    const useRelatedBlankDocument = navigator.userAgent.includes("Windows");
    const popup = window.open(useRelatedBlankDocument ? "about:blank" : url.href,
      "rds-" + name, "popup,resizable,width=750,height=524");
    if (!popup) { reportFailure("A janela auxiliar foi recusada."); return; }
    windows.current[name] = popup;
    let attempts = 0;
    let reason = "O documento do painel ainda não foi apresentado.";
    const mount = () => {
      if (windows.current[name] !== popup) return;
      try {
        const page = popup.closed ? null : popup.document;
        const ready = useRelatedBlankDocument
          ? popup.opener === window && page?.URL === "about:blank" && page.readyState !== "loading"
          : page?.body?.hasAttribute("data-studio-panel-ready");
        if (ready && page?.body) {
          mountPopup(popup, name, hosts[name], () => dockPanel(name));
          setOpen((current) => ({ ...current, [name]: true }));
          return;
        }
        if (page) reason = "O WebView apresentou " + page.URL;
      } catch (error) {
        reason = error instanceof Error ? error.message : String(error);
      }
      if (++attempts < 100 && !popup.closed) window.setTimeout(mount, 50);
      else { dockPanel(name); reportFailure(reason); }
    };
    window.setTimeout(mount, 0);
  }, [dockPanel, hosts, reportFailure]);

  const assignDock = useCallback((name: FloatingStudioPanel, destination: HTMLElement | null) => {
    if (!destination) { delete docks.current[name]; return; }
    docks.current[name] = destination;
    if (!windows.current[name] || windows.current[name]?.closed) destination.append(hosts[name]);
  }, [hosts]);
  const timelineDock: RefCallback<HTMLDivElement> = useCallback((node) => assignDock("timeline", node), [assignDock]);
  const propertiesDock: RefCallback<HTMLDivElement> = useCallback((node) => assignDock("properties", node), [assignDock]);

  useEffect(() => {
    const ownerWindows = windows.current;
    const timer = setInterval(() => {
      for (const name of panelNames) if (ownerWindows[name]?.closed) dockPanel(name);
    }, 400);
    return () => {
      clearInterval(timer);
      for (const name of panelNames) {
        const popup = ownerWindows[name];
        delete ownerWindows[name];
        if (popup) closePanelWindow(name, popup);
      }
    };
  }, [dockPanel]);

  return { hosts, timelineDock, propertiesDock, open, floatPanel, dockPanel };
}
