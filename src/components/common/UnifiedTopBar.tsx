import { useEffect, useRef, useState, type ReactNode } from "react";

export interface UnifiedTopBarAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: "default" | "primary" | "success" | "danger";
  title?: string;
  shortcut?: string;
  testId?: string;
}

export interface UnifiedTopBarSection {
  title?: string;
  actions: UnifiedTopBarAction[];
}

export interface UnifiedTopBarProps {
  appName: string;
  appTagline?: string;
  breadcrumbs: string[];
  menuSections: UnifiedTopBarSection[];
  centerContent?: ReactNode;
  rightContent?: ReactNode;
}

function menuActionTone(accent: UnifiedTopBarAction["accent"] = "default") {
  if (accent === "primary") {
    return "border-[#cba6f7]/30 text-[#e9d5ff] hover:border-[#cba6f7]/45 hover:bg-[#cba6f7]/12";
  }
  if (accent === "success") {
    return "border-[#a6e3a1]/30 text-[#bbf7d0] hover:border-[#a6e3a1]/45 hover:bg-[#a6e3a1]/12";
  }
  if (accent === "danger") {
    return "border-[#f38ba8]/30 text-[#fecdd3] hover:border-[#f38ba8]/45 hover:bg-[#f38ba8]/12";
  }
  return "border-transparent text-[#cbd5e1] hover:border-[#334155] hover:bg-[#111827]";
}

export default function UnifiedTopBar({
  appName,
  appTagline,
  breadcrumbs,
  menuSections,
  centerContent,
  rightContent,
}: UnifiedTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header
      data-testid="unified-topbar"
      className="relative z-20 grid shrink-0 grid-cols-[minmax(200px,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-[#27272a] bg-[#10131d] px-3 py-2"
    >
      <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            ref={triggerRef}
            aria-expanded={menuOpen}
            aria-controls="studio-main-menu"
            data-testid="unified-topbar-menu-trigger"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex h-8 items-center justify-center rounded border border-[#3f3f46] bg-[#111827] px-2 text-[10px] font-semibold uppercase text-[#e2e8f0] transition-colors hover:border-[#6366f1]/30 hover:bg-[#1f2937]"
          >
            Menu
          </button>

          {menuOpen && (
            <div id="studio-main-menu" className="absolute left-0 top-[calc(100%+8px)] z-50 max-h-[calc(100vh-100px)] w-72 overflow-y-auto rounded border border-[#313244] bg-[#0b1120] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
              {menuSections.map((section, sectionIndex) => (
                <div
                  key={`${section.title ?? "section"}-${sectionIndex}`}
                  className={sectionIndex > 0 ? "border-t border-[#1f2937]" : undefined}
                >
                  {section.title && (
                    <div className="px-3 py-2 text-[10px] font-semibold uppercase text-[#7dd3fc]">
                      {section.title}
                    </div>
                  )}
                  <div className="grid gap-1 px-2 py-2">
                    {section.actions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        disabled={action.disabled}
                        title={action.title}
                        data-testid={action.testId}
                        onClick={() => {
                          setMenuOpen(false);
                          action.onClick();
                        }}
                        className={`flex items-center justify-between rounded border px-3 py-2 text-left text-[12px] font-medium transition-colors ${menuActionTone(action.accent)} disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        <span>{action.label}</span>
                        {action.shortcut ? (
                          <kbd className="ml-3 rounded border border-[#334155] bg-[#020617] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#94a3b8]">
                            {action.shortcut}
                          </kbd>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase text-[#cba6f7]">
            {appName}
          </div>
          {appTagline ? (
            <div className="sr-only">{appTagline}</div>
          ) : null}
        </div>

        <nav
          aria-label="Breadcrumb"
          data-testid="unified-topbar-breadcrumbs"
          className="min-w-0 flex-1 overflow-hidden rounded border border-[#27272a] bg-[#0b1220]/80 px-2 py-1"
        >
          <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[11px] text-[#94a3b8]">
            {breadcrumbs.map((crumb, index) => (
              <div key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-2">
                {index > 0 ? <span className="text-[#475569]">&gt;</span> : null}
                <span
                  className={index === breadcrumbs.length - 1 ? "truncate text-[#e2e8f0]" : "truncate"}
                  title={crumb}
                >
                  {crumb}
                </span>
              </div>
            ))}
          </div>
        </nav>
      </div>

      <div
        data-testid="unified-topbar-center"
        className="col-span-2 row-start-2 flex min-w-0 items-center overflow-x-auto pb-1"
      >
        <div className="relative z-[5] flex flex-nowrap items-center gap-2 px-0.5">
          {centerContent}
        </div>
      </div>

      <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-end">
        <div className="flex min-w-0 items-center justify-end gap-2">{rightContent}</div>
      </div>
    </header>
  );
}
