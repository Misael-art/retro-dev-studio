// Ponte Studio → REX (Experimental, REQ-19/S6). Numa ROM comercial a navegação só existe para o que um
// perfil REX localizou e comprovou nesta ROM (identidade: SHA da ROM + perfil + offset da instância).
// O resto do quadro é "desconhecido": só inspeção/anotação, sem editor semântico inventado.
import type { RexProfileLocateResponse } from "./ipc/toolsService";

export interface RexBridgeItem {
  key: string;
  profileId: string;
  profileSha256: string;
  title: string;
  selection: string;
  instanceOffset: number;
  status: string;
  bound: boolean;
}

export interface RexBridgeRequest {
  seq: number;
  romPath: string;
  romSha256: string;
  key: string;
}

export function rexInstanceKey(profileId: string, instanceOffset: number): string {
  return `${profileId}@0x${instanceOffset.toString(16)}`;
}

/** Itens navegáveis; recusa resposta de outra ROM (resultado de outro contexto). */
export function rexBridgeItems(response: RexProfileLocateResponse, runningRomSha256: string | null): RexBridgeItem[] | { error: string } {
  if (!runningRomSha256 || response.rom_sha256 !== runningRomSha256) {
    return { error: "A localização é de outra ROM; localize de novo com a ROM em execução." };
  }
  return response.matches.flatMap((match) =>
    match.instances.map((instance) => ({
      key: rexInstanceKey(match.profile.id, instance.instance_offset),
      profileId: match.profile.id,
      profileSha256: match.profile.sha256,
      title: match.profile.title,
      selection: instance.selection.label,
      instanceOffset: instance.instance_offset,
      status: match.profile.status,
      bound: match.bound,
    }))
  );
}
