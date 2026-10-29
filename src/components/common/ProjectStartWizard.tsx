import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ExternalImportProfileSummary, ProjectDestinationPreview, ProjectTemplateSummary } from "../../core/ipc/projectService";
import Dialog from "./Dialog";
import Icon, { type IconName } from "./Icon";

type Intent = "new" | "template" | "open" | "import";
type Step = "home" | "platform" | "templates" | "profiles" | "details" | "open";
export interface ProjectStartWizardProps {
  activeProject: boolean;
  startInImport?: boolean;
  busy: boolean;
  loading: boolean;
  name: string;
  target: "megadrive" | "snes";
  templates: ProjectTemplateSummary[];
  selectedTemplate: ProjectTemplateSummary | null;
  canCreateSelected: boolean;
  profiles: ExternalImportProfileSummary[];
  selectedProfile: ExternalImportProfileSummary | null;
  destination: string;
  collision: ProjectDestinationPreview | null;
  suggestedName: string | null;
  error: string;
  firstSuccess: ReactNode;
  advancedTemplates: ReactNode;
  importDetails: ReactNode;
  onName: (value: string) => void;
  onTarget: (value: "megadrive" | "snes") => void;
  onTemplate: (id: string) => void;
  onProfile: (id: string) => void;
  onBegin: (intent: Intent) => void;
  onCreate: () => void;
  onImport: () => void;
  onOpen: () => void;
  onOpenDetected: () => void;
  onSuggestedName: () => void;
  onChooseImportDestination: () => void;
  onClose: () => void;
}

const INTENTS: { id: Intent; icon: IconName; title: string; detail: string }[] = [
  { id: "new", icon: "spawn", title: "Criar do zero", detail: "Uma cena vazia para construir seu próprio jogo." },
  { id: "template", icon: "studio-scene", title: "Começar com um modelo", detail: "Escolha uma base pronta e transforme em seu jogo." },
  { id: "open", icon: "studio-files", title: "Abrir projeto", detail: "Continue um projeto RetroDev que você já salvou." },
  { id: "import", icon: "export", title: "Importar projeto", detail: "Traga um projeto Mega Drive, MUGEN ou outro formato disponível." },
];
const platformName = (target: "megadrive" | "snes") => target === "megadrive" ? "Mega Drive" : "Super Nintendo";

export default function ProjectStartWizard(p: ProjectStartWizardProps) {
  const [intent, setIntent] = useState<Intent>(p.startInImport ? "import" : "template");
  const [step, setStep] = useState<Step>(p.startInImport ? "profiles" : "home");
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === "details") { input.current?.focus(); input.current?.select(); }
    else heading.current?.focus();
  }, [step]);

  function begin(value: Intent) {
    p.onBegin(value); setIntent(value);
    setStep(value === "open" ? "open" : value === "import" ? "profiles" : "platform");
  }
  function platform(value: "megadrive" | "snes") {
    p.onTarget(value);
    if (intent === "new") { p.onTemplate("empty"); setStep("details"); }
    else setStep("templates");
  }
  function back() {
    if (step === "details") setStep(intent === "import" ? "profiles" : intent === "template" ? "templates" : "platform");
    else if (step === "templates") setStep("platform");
    else setStep("home");
  }
  const titles: Record<Step, string> = { home: "O que você quer criar hoje?", platform: "Para qual console?", templates: "Escolha seu ponto de partida", profiles: "Qual é a origem do projeto?", details: intent === "import" ? "Prepare a importação" : "Dê um nome ao seu jogo", open: "Continue seu projeto" };
  const candidates = p.templates.filter(t => t.source_kind === "builtin" && t.id !== "empty" && (p.target === "megadrive" || !t.mega_drive_only));
  const selectedReady = p.selectedTemplate?.available && (p.target === "megadrive" || !p.selectedTemplate.mega_drive_only);
  const chooseProfile = (id: string) => { p.onProfile(id); setStep("details"); };
  const profileCard = (profile: ExternalImportProfileSummary) => <button type="button" key={profile.id}
    data-testid={`external-import-profile-${profile.id}`} disabled={!profile.importable || p.busy}
    className="rds-start-card" onClick={() => chooseProfile(profile.id)}>
    <Icon name={profile.id === "sgdk" ? "chip" : "studio-game"} size={34} />
    <strong>{profile.id === "sgdk" ? "Mega Drive / SGDK" : profile.name}</strong>
    <span>{profile.id === "sgdk" ? "Código e recursos de um projeto Mega Drive existente." : profile.description}</span>
    <small>{profile.importable ? profile.experimental ? "Experimental" : "Disponível" : "Ainda indisponível"}</small>
  </button>;

  return <Dialog open portal={false} title="Seu próximo jogo" description="Um passo de cada vez, do começo ao primeiro teste."
    closeDisabled={p.busy} onClose={p.onClose} className="!w-[min(820px,calc(100vw-24px))]">
    <div className="rds-start" data-testid="project-start-wizard" data-step={step} data-intent={intent} data-target={p.target}>
      <div className="rds-start-heading">
        {step !== "home" && <button type="button" onClick={back} disabled={p.busy} data-testid="wizard-back" className="rds-start-back">← Voltar</button>}
        <h2 ref={heading} tabIndex={-1}>{titles[step]}</h2>
        {step !== "home" && <p className="rds-start-trail" aria-label="Caminho escolhido">{INTENTS.find(i => i.id === intent)?.title}{intent === "new" || intent === "template" ? ` · ${platformName(p.target)}` : ""}</p>}
      </div>
      <div data-testid="project-wizard-body" className="rds-start-body">
        {step === "home" && <div className="rds-start-grid" data-testid="wizard-intents">
          {INTENTS.map(item => <button type="button" key={item.id} data-testid={`wizard-intent-${item.id}`} onClick={() => begin(item.id)} className="rds-start-card">
            <Icon name={item.icon} size={36} /><strong>{item.title}</strong><span>{item.detail}</span><b aria-hidden="true">→</b>
          </button>)}
        </div>}
        {step === "platform" && <div className="rds-start-grid" data-testid="wizard-platforms">
          {(["megadrive", "snes"] as const).map(target => <button type="button" key={target} className="rds-start-card rds-console-card"
            data-testid={`wizard-target-${target}`} onClick={() => platform(target)}>
            <span className={`rds-console-drawing rds-console-drawing--${target}`} aria-hidden="true"><i /><b /><em /><u /></span>
            <strong>{platformName(target)}</strong><span>{target === "megadrive" ? "Crie para o console de 16 bits da Sega." : "Crie para o console de 16 bits da Nintendo."}</span>
          </button>)}
          <p className="rds-start-note">Outras plataformas serão apresentadas aqui quando estiverem disponíveis.</p>
        </div>}
        {step === "templates" && <>
          <p className="rds-start-note">Escolher um modelo cria uma cópia nova para você editar.</p>
          {p.loading ? <p role="status">Carregando modelos…</p> : <div className="rds-start-grid" data-testid="wizard-recommended-start">
            {candidates.map(template => <button type="button" key={template.id} className="rds-start-card"
              data-testid={`template-card-${template.id}`} disabled={!template.available} onClick={() => { p.onTemplate(template.id); setStep("details"); }}>
              <Icon name={template.id === "reference_platformer" ? "studio-game" : "studio-scene"} size={34} />
              <strong>{template.name}</strong><span>{template.description}</span>
              {template.experimental && <small>Experimental</small>}<b aria-hidden="true">→</b>
            </button>)}
            {!candidates.length && <p role="status">Nenhum modelo disponível para este console. Você pode voltar e criar do zero.</p>}
          </div>}
        </>}
        {step === "profiles" && <>
          {p.loading ? <p role="status">Carregando formatos…</p> : <div className="rds-start-grid">{p.profiles.filter(profile => ["sgdk", "mugen"].includes(profile.id)).map(profileCard)}</div>}
          <details className="rds-start-more" data-testid="wizard-external-import-section"><summary>Mais formatos e modelos externos</summary>
            <div className="rds-start-grid">{p.profiles.filter(profile => !["sgdk", "mugen"].includes(profile.id)).map(profileCard)}</div>
            <label>Formato de origem<select data-testid="external-import-profile-select" value={p.selectedProfile?.id ?? ""} onChange={event => chooseProfile(event.target.value)}>
              {p.profiles.map(profile => <option key={profile.id} value={profile.id} disabled={!profile.importable}>{profile.name} · {profile.support_status}</option>)}
            </select></label>
            <details data-testid="wizard-import-advanced"><summary>Modelos com pasta doadora · Experimental</summary>{p.advancedTemplates}
              {p.selectedTemplate?.source_kind === "external_sgdk" && <div className="rds-start-more">
                <label className="rds-start-name">Nome da cópia<input data-testid="wizard-project-name" value={p.name} onChange={e => p.onName(e.target.value)} /></label>
                <button type="button" data-testid="wizard-create-project" className="rds-start-primary" onClick={p.onCreate} disabled={p.busy || !p.canCreateSelected}>Criar Projeto</button>
                {p.firstSuccess}
              </div>}
            </details>
          </details>
        </>}
        {step === "open" && <div className="rds-start-open">
          <Icon name="studio-files" size={56} /><p>Selecione o arquivo <strong>project.rds</strong> do projeto que deseja continuar.</p>
          <button type="button" data-testid="wizard-open-project" className="rds-start-primary" disabled={p.busy} onClick={p.onOpen}>Selecionar projeto salvo</button>
        </div>}
        {step === "details" && <form id="project-start-form" onSubmit={event => { event.preventDefault(); if (!p.busy) { if (intent === "import") p.onImport(); else p.onCreate(); } }}>
          <div className="rds-start-summary"><Icon name={intent === "import" ? "studio-files" : "studio-game"} size={30} />
            <div><strong>{intent === "import" ? p.selectedProfile?.name : intent === "new" ? "Projeto do zero" : p.selectedTemplate?.name}</strong>
              <p>{intent === "import" ? "Uma cópia será preparada no formato do RetroDev." : platformName(p.target)}</p></div>
          </div>
          <label className="rds-start-name">Nome do projeto<input ref={input} placeholder="Nome do projeto" data-testid="wizard-project-name" value={p.name} onChange={e => p.onName(e.target.value)} required maxLength={120} disabled={p.busy} /></label>
          {p.suggestedName && <p className="rds-start-note">Este nome já existe. <button type="button" onClick={p.onSuggestedName} data-testid="wizard-project-name-suggestion">Usar {p.suggestedName}</button></p>}
          <p className="rds-start-note">Seu projeto será salvo automaticamente no local padrão.</p>
          <details className="rds-start-more"><summary>Ver local e detalhes</summary>
            <p data-testid="wizard-project-destination" className="rds-start-path">{p.destination}</p>
            {intent === "import" && <button type="button" onClick={p.onChooseImportDestination}>Escolher outro local para a cópia</button>}
            {p.collision?.existing_project_path && <div data-testid="wizard-existing-project-card"><p>Projeto RetroDev encontrado: {p.collision.existing_project_name}. O original será preservado.</p><p data-testid="wizard-existing-project-path">{p.collision.existing_project_path}</p>
              <button type="button" data-testid="wizard-open-existing-project" onClick={p.onOpenDetected}>Continuar no projeto existente</button></div>}
          </details>
          {intent === "template" && <details className="rds-start-more"><summary>Primeiros passos com este modelo</summary>{p.firstSuccess}</details>}
          {intent === "import" && <details className="rds-start-more"><summary>O que este importador faz · {p.selectedProfile?.support_status}</summary><p>{p.selectedProfile?.description}</p>{p.importDetails}</details>}
        </form>}
        {p.error && <p role="alert" className="rds-start-error">{p.error}</p>}
      </div>
      <div data-testid="project-wizard-actions" className="rds-start-footer">
        <button type="button" data-testid={p.activeProject ? "wizard-cancel" : "wizard-continue-without-project"} onClick={p.onClose} disabled={p.busy} className="rds-start-back">{p.activeProject ? "Cancelar" : "Explorar sem projeto"}</button>
        {step === "details" && <button type="submit" form="project-start-form" className="rds-start-primary"
          data-testid={intent === "import" ? "external-import-confirm" : "wizard-create-project"}
          disabled={p.busy || p.loading || !p.name.trim() || (intent === "import" ? !p.selectedProfile?.importable : !selectedReady)}>
          {p.busy ? intent === "import" ? "Importando…" : "Criando…" : intent === "import" ? "Selecionar pasta e importar" : "Criar Projeto"}
        </button>}
      </div>
    </div>
  </Dialog>;
}
