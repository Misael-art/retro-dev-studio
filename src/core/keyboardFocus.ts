// Foco de teclado (REQ-06): o que o usuário digita num campo nunca vira comando do jogo nem atalho.
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Campos e controles focados recebem a tecla; a superfície do jogo dirige o joypad. */
export function gameMayTakeKeyDown(event: Pick<KeyboardEvent, "target">): boolean {
  const target = event.target;
  if (typeof Element === "undefined" || !(target instanceof Element)) return true;
  return !isEditableTarget(target) && !target.closest("button, summary, a[href], [role='button'], [role='menuitem']");
}
