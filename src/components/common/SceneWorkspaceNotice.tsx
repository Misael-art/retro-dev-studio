import type { ReactNode } from "react";

import type { SceneWorkspaceContext } from "../../core/sceneWorkspaceContext";

const NOTICE_TONE = {
  info: "border-[#89b4fa]/30 bg-[#89b4fa]/8 text-[#89b4fa]",
  warn: "border-[#fab387]/30 bg-[#fab387]/8 text-[#fab387]",
  success: "border-[#a6e3a1]/30 bg-[#a6e3a1]/8 text-[#a6e3a1]",
} as const;

type SceneWorkspaceNoticeProps = {
  context: SceneWorkspaceContext;
  testId?: string;
  actions?: ReactNode;
  compact?: boolean;
};

export default function SceneWorkspaceNotice({
  context,
  testId,
  actions,
  compact = false,
}: SceneWorkspaceNoticeProps) {
  const content = (
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-[1_1_220px]">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em]">
            {context.eyebrow}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[#e2e8f0]">
            {context.title}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-[#cbd5e1]">
            {context.summary}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-[9px] font-semibold text-[#e5e7eb]">
              {context.sourceBadgeLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-[9px] text-[#bac2de]">
              {context.activeSceneLabel}
            </span>
            {context.checkpoints.map((checkpoint) => (
              <span
                key={checkpoint}
                className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-[9px] text-[#bac2de]"
              >
                {checkpoint}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[#94a3b8]">
            {context.detail}
          </p>
        </div>
        {actions ? <div className="flex max-w-full flex-wrap gap-2">{actions}</div> : null}
      </div>
  );
  const className = `rounded border px-3 py-2 ${NOTICE_TONE[context.tone]}`;
  return compact ? (
    <details data-testid={testId} className={className}>
      <summary className="cursor-pointer text-[11px] font-semibold">{context.title}</summary>
      <div className="mt-2">{content}</div>
    </details>
  ) : <section data-testid={testId} className={className}>{content}</section>;
}
