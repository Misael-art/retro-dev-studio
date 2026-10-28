// Lógica do jogo C nativo dentro da tarefa Lógica (Experimental). Em projetos SGDK com código
// original, o comportamento real está no C: aqui ele aparece organizado (arquivos por pasta,
// máquinas de estado e funções), com o mesmo editor por nodes do Explorer.
import { useEffect, useMemo, useState } from "react";

import { getSgdkCGraphIndex, type CGraphIndex } from "../../core/ipc/projectService";
import { CGraphPanel } from "../explorer/CGraphPanel";

interface GameCodeLogicProps {
  projectDir: string;
}

export function GameCodeLogic({ projectDir }: GameCodeLogicProps) {
  const [index, setIndex] = useState<CGraphIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    getSgdkCGraphIndex(projectDir)
      .then((next) => {
        if (!alive) return;
        setIndex(next);
        // Começa pelo arquivo com mais máquinas de estado: é onde está o fluxo do jogo.
        const counts = new Map<string, number>();
        for (const m of next.state_machines) counts.set(m.file, (counts.get(m.file) ?? 0) + 1);
        const first = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? next.files[0]?.source_file ?? null;
        setFile((current) => current ?? first);
      })
      .catch((cause) => alive && setError(String(cause)));
    return () => {
      alive = false;
    };
  }, [projectDir]);

  const groups = useMemo(() => {
    if (!index) return [];
    const needle = filter.trim().toLowerCase();
    const byDir = new Map<string, { file: string; machines: number; functions: number }[]>();
    for (const entry of index.files) {
      const name = entry.source_file;
      const machines = index.state_machines.filter((m) => m.file === name);
      const functions = index.functions.filter((f) => f.file === name);
      if (
        needle &&
        !name.toLowerCase().includes(needle) &&
        !machines.some((m) => m.subject.toLowerCase().includes(needle)) &&
        !functions.some((f) => f.name.toLowerCase().includes(needle))
      ) {
        continue;
      }
      const dir = name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : ".";
      const list = byDir.get(dir) ?? [];
      list.push({ file: name, machines: machines.length, functions: functions.length });
      byDir.set(dir, list);
    }
    return [...byDir.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [index, filter]);

  if (error) {
    return (
      <p data-testid="game-code-error" className="p-4 text-[11px] text-[#f38ba8]">
        Código C indisponível: {error}
      </p>
    );
  }
  if (!index) return <p className="p-4 text-[11px] text-[#7f849c]">Carregando o código do jogo…</p>;

  return (
    <div data-testid="game-code-logic" className="flex h-full min-h-0">
      <aside className="flex w-64 shrink-0 flex-col border-r border-[#313244] bg-[#11111b]">
        <div className="border-b border-[#313244] p-2 text-[10px] text-[#a6adc8]">
          <p>
            {index.files.length} arquivos · {index.state_machines.length} máquinas de estado · {index.functions.length} funções
          </p>
          <input
            data-testid="game-code-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar arquivo, função ou estado"
            aria-label="Buscar no código do jogo"
            className="mt-1 w-full rounded border border-[#45475a] bg-[#181825] px-2 py-1 text-[11px] text-[#cdd6f4]"
          />
        </div>
        <nav aria-label="Arquivos do jogo" className="min-h-0 flex-1 overflow-y-auto p-1">
          {groups.map(([dir, files]) => (
            <div key={dir} className="mb-1">
              <p className="px-1 pt-1 text-[9px] font-semibold uppercase tracking-wide text-[#7f849c]">{dir}</p>
              {files.map((entry) => (
                <button
                  key={entry.file}
                  type="button"
                  data-testid={`game-code-file-${entry.file}`}
                  aria-current={entry.file === file ? "true" : undefined}
                  onClick={() => setFile(entry.file)}
                  className={`flex w-full items-center justify-between gap-1 rounded px-2 py-0.5 text-left text-[11px] ${
                    entry.file === file ? "bg-[#1e3a5f] text-white" : "text-[#cdd6f4] hover:bg-[#181825]"
                  }`}
                >
                  <span className="truncate">{entry.file.split("/").pop()}</span>
                  <span className="shrink-0 text-[9px] text-[#7f849c]">
                    {entry.machines ? `${entry.machines} FSM · ` : ""}
                    {entry.functions} fn
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <section className="min-h-0 min-w-0 flex-1 overflow-y-auto p-2">
        {file ? <CGraphPanel key={file} projectDir={projectDir} sourceFile={file} /> : null}
      </section>
    </div>
  );
}
