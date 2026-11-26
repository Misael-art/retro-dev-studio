import { useEffect, useRef } from "react";

/** A single top-layer hint also works for controls inside scrollable toolbars. */
export default function CommandHint() {
  const hintRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hint = hintRef.current;
    if (!hint || typeof hint.showPopover !== "function") return;
    let owner: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function hide() {
      clearTimeout(timer);
      hint?.hidePopover();
      owner = null;
    }
    function enter(event: Event) {
      const button = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-tool-hint]") : null;
      if (!button || (event.type === "mouseover" && owner === button)) return;
      hide();
      owner = button;
      const show = () => {
        if (!button.isConnected || !hint) return;
        const rect = button.getBoundingClientRect();
        hint.textContent = button.dataset.toolHint || button.title;
        hint.showPopover();
        hint.style.left = Math.max(4, Math.min(rect.left, innerWidth - hint.offsetWidth - 4)) + "px";
        hint.style.top = (rect.bottom + hint.offsetHeight + 8 < innerHeight
          ? rect.bottom + 4 : Math.max(4, rect.top - hint.offsetHeight - 4)) + "px";
      };
      if (event.type === "focusin") show();
      else timer = setTimeout(show, 380);
    }
    function leave(event: MouseEvent | FocusEvent) {
      if (owner && event.target instanceof Node && owner.contains(event.target)
        && !(event.relatedTarget instanceof Node && owner.contains(event.relatedTarget))) hide();
    }
    function key(event: KeyboardEvent) { if (event.key === "Escape") hide(); }
    document.addEventListener("focusin", enter);
    document.addEventListener("mouseover", enter);
    document.addEventListener("focusout", leave);
    document.addEventListener("mouseout", leave);
    document.addEventListener("keydown", key);
    document.addEventListener("click", hide);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      hide();
      document.removeEventListener("focusin", enter);
      document.removeEventListener("mouseover", enter);
      document.removeEventListener("focusout", leave);
      document.removeEventListener("mouseout", leave);
      document.removeEventListener("keydown", key);
      document.removeEventListener("click", hide);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);
  return <div ref={hintRef} popover="manual" aria-hidden="true" className="rds-command-hint" />;
}
