// Ligações do objeto selecionado: problemas que o envolvem (com ação) e atalho para o asset dele.
import { attentionForEntity } from "../../core/sceneAttention";
import { requestAppCommand, useSceneAttentionStore } from "../../core/sceneAttentionStore";
import { useEditorStore } from "../../core/store/editorStore";
import { AttentionList, useSceneAttentionItems } from "../viewport/SceneAttentionPanel";

export default function EntityAttentionSection({ entityId }: { entityId: string }) {
  const items = useSceneAttentionItems();
  const related = attentionForEntity(items, entityId);
  const asset = useEditorStore(
    (s) => {
      const entity = s.activeScene?.entities.find((e) => e.entity_id === entityId);
      return entity?.components.sprite?.asset ?? entity?.components.tilemap?.tileset ?? null;
    }
  );
  const revealAsset = useSceneAttentionStore((s) => s.revealAsset);
  if (related.length === 0 && !asset) return null;
  return (
    <div data-testid="inspector-entity-attention" className="border-b border-[#313244] px-3 py-1.5">
      {related.length > 0 ? (
        <>
          <p className="mb-1 text-[10px] font-semibold text-[#fab387]">Atenção neste objeto</p>
          <AttentionList items={related} compact />
        </>
      ) : null}
      {asset ? (
        <button
          type="button"
          data-testid="inspector-reveal-asset"
          onClick={() => {
            revealAsset(asset);
            requestAppCommand("tools.assetBrowser");
          }}
          className="mt-1 text-[10px] text-[#89b4fa] hover:underline"
          title={asset}
        >
          Ver imagem no Asset Browser →
        </button>
      ) : null}
    </div>
  );
}
