// Layout das etiquetas do viewport (nome, selo de paleta, modo de posição): uma etiqueta por
// objeto, ancorada no canto do objeto e deslocada sem sobrepor as já colocadas. Objetos na
// mesma origem (camadas de tela inteira) viram uma lista empilhada em vez de texto sobreposto.

export interface TagRequest {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Etiquetas prioritárias (seleção) escolhem posição primeiro. */
  priority?: number;
}

export interface PlacedTag {
  id: string;
  x: number;
  y: number;
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Coloca cada etiqueta na âncora; se colidir, tenta descer em passos da própria altura e, depois
 * de `maxSteps`, abre uma nova coluna à direita. Determinístico (ordem: prioridade, y, x, id).
 */
export function layoutTags(requests: TagRequest[], gap = 2, maxSteps = 12): PlacedTag[] {
  const ordered = [...requests].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)
  );
  const placed: (PlacedTag & { width: number; height: number })[] = [];
  for (const request of ordered) {
    let spot = { x: request.x, y: request.y, width: request.width, height: request.height };
    let column = 0;
    let step = 0;
    while (placed.some((other) => overlaps(spot, other))) {
      step += 1;
      if (step > maxSteps) {
        step = 0;
        column += 1;
      }
      spot = {
        ...spot,
        x: request.x + column * (request.width + gap),
        y: request.y + step * (request.height + gap),
      };
      if (column > 8) break;
    }
    placed.push({ id: request.id, ...spot });
  }
  return placed.map(({ id, x, y }) => ({ id, x, y }));
}
