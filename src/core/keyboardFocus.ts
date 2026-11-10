// Foco de teclado (REQ-06): o que o usuário digita num campo nunca vira comando do jogo nem atalho.
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** A tecla pode ir para o joypad? Pressionar num campo editável: não (e o texto não é bloqueado). */
export function gameMayTakeKeyDown(event: Pick<KeyboardEvent, "target">): boolean {
  return !isEditableTarget(event.target);
}
