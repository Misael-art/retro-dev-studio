type WorkspaceTabsProps<T extends string> = {
  name: string;
  label: string;
  tabs: readonly (readonly [T, string])[];
  value: T;
  onChange: (tab: T) => void;
  testIdPrefix?: string;
};

export default function WorkspaceTabs<T extends string>({ name, label, tabs, value, onChange, testIdPrefix = `${name}-tab` }: WorkspaceTabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex min-w-0 shrink-0 overflow-x-auto border-b border-[#313244] bg-[#111827]">
      {tabs.map(([tab, caption], index) => (
        <button
          key={tab}
          id={`${name}-tab-${tab}`}
          type="button"
          role="tab"
          data-testid={`${testIdPrefix}-${tab}`}
          aria-selected={value === tab}
          aria-controls={`${name}-panel-${tab}`}
          tabIndex={value === tab ? 0 : -1}
          onClick={() => onChange(tab)}
          onKeyDown={(event) => {
            let nextIndex: number;
            switch (event.key) {
              case "ArrowRight": nextIndex = (index + 1) % tabs.length; break;
              case "ArrowLeft": nextIndex = (index - 1 + tabs.length) % tabs.length; break;
              case "Home": nextIndex = 0; break;
              case "End": nextIndex = tabs.length - 1; break;
              default: return;
            }
            event.preventDefault();
            const next = tabs[nextIndex][0];
            onChange(next);
            document.getElementById(`${name}-tab-${next}`)?.focus();
          }}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rds-focus-ring)] ${
            value === tab ? "border-b-2 border-[var(--rds-action-primary)] text-[var(--rds-text-primary)]" : "text-[var(--rds-text-secondary)]"
          }`}
        >
          {caption}
        </button>
      ))}
    </div>
  );
}
