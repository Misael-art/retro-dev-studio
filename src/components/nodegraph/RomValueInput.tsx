import { useEffect, useState } from "react";

interface Props {
  testId: string;
  label: string;
  value: number | string;
  /** "min..max" do campo (faixa segura vinda do núcleo); só informativo e para sinalizar fora da faixa. */
  faixa?: string;
  onCommit: (value: number) => void;
}

/**
 * Campo numérico de um nó editável da ponte ROM ↔ nodes. Permite digitar negativos (o "-" sozinho não
 * vira 0), só confirma inteiros e NÃO limita o valor: fora da faixa o valor entra no grafo e a ponte
 * mostra o problema, em vez de o campo corrigir em silêncio.
 */
export default function RomValueInput({ testId, label, value, faixa, onCommit }: Props) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const m = faixa ? /^(-?\d+)\.\.(-?\d+)$/.exec(faixa) : null;
  const n = /^-?\d+$/.test(text.trim()) ? Number(text.trim()) : null;
  const fora = n !== null && m !== null && (n < Number(m[1]) || n > Number(m[2]));
  const invalido = n === null || fora;
  return (
    <input
      data-testid={testId}
      aria-label={label}
      aria-invalid={invalido}
      title={faixa ? `faixa segura ${faixa}` : undefined}
      inputMode="numeric"
      value={text}
      onMouseDown={(event) => event.stopPropagation()}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        if (/^-?\d+$/.test(next.trim())) onCommit(Number(next.trim()));
      }}
      onBlur={() => {
        if (n === null) setText(String(value));
      }}
      className={`w-20 rounded border bg-[#11111b] px-1 py-0.5 text-right font-mono text-[#cdd6f4] outline-none focus:border-[#f9e2af] ${invalido ? "border-[#f38ba8]" : "border-[#a6e3a1]/60"}`}
    />
  );
}
