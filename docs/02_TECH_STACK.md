# 02 - TECH STACK & ARQUITETURA DE SISTEMA
**Status:** Definitivo

> Nenhuma nova tecnologia entra no projeto sem refletir aqui.

---

## 1. Principios

1. Performance nativa no core, build e emulacao.
2. UI rica, mas desacoplada do backend.
3. Sem GC no loop principal do runtime/exporter.
4. O fluxo de build em runtime continua 100% Rust no app; scripts externos entram apenas como toolchains oficiais de terceiros.

---

## 2. Stack Definitiva

### Desktop / Frontend
- Tauri JS API `2.11.0`, CLI `2.11.2` e dialog plugin `2.7.1`, fixados no lock npm
- React
- TypeScript
- Vite
- TailwindCSS
- Zustand para estado de editor
- react-resizable-panels para layout redimensionavel (docking/splitters)
- ESLint para lint estatico do frontend

### Backend / Core
- Rust `1.97.0`
- Tauri Rust `2.11.5`, build `2.6.3`, opener `2.5.4` e dialog `2.7.1`, fixados no Cargo lock
- IPC Tauri para toda operacao de filesystem, build e emulacao
- `serde` / `serde_json` para schema UGDM
- Rascunhos desktop: `scenePersistence.ts` mantém formato/contexto/revisão e usa IPC `scene_draft_storage`, no backend existente, para escrita atômica + sincronização + leitura de confirmação em `<projeto>/.rds/scene-drafts/<SHA256(scenePath)>.json`. `localStorage` é entrada legada de migração; sua leitura não comprova durabilidade após matar WebKit. Sem novo banco, dependência ou autosave paralelo; a cena editável só muda pelo save canônico. Falha antes do recibo deixa o rascunho não confirmado. Isso não garante sobrevivência a perda do disco ou falha de energia em qualquer filesystem.

### Emulacao
- Libretro API via FFI no Rust
- Cores oficiais consumidos como binarios externos
- Mega Drive: Genesis Plus GX ou Picodrive
- SNES: Snes9x ou bsnes

### Toolchains Alvo
- SGDK para Mega Drive
- PVSnesLib para SNES
- Provisionamento bloqueado pelo manifesto comum em Windows e Linux a partir do upstream oficial

### Crates de suporte aprovadas no backend
- `base64` para codificacao de imagens processadas (Photo2SGDK)
- `libloading` para carregar cores Libretro
- `sevenz-rust2` para leitura de corpus/projetos compactados; downloads e extracao de toolchains pertencem exclusivamente ao host-manager, nao ao runtime Rust
- `image` para staging/conversao de asset real no caminho SNES e processamento Photo2SGDK (quantizacao, palette snapping Mega Drive)
- Proposta2026-10-30, ainda sem qualificação Rust/desktop: Photo2SGDK oferece agrupamento ponderado, cores frequentes sem dithering e Floyd–Steinberg por quadro. Metodologia adaptada dos scripts existentes SGDKForge/SMSForge ao RGB333 MD; nenhum runtime Python/OpenCV/Pillow/modelo neural ou dependência nova. Operações do PixelEditor permanecem no PixelDoc e writer existentes; detalhes/proveniência/limites no Memory Bank.
- Entrada de imagens da web (validada em Linux, Experimental, 2026-10-30): uso direto de `reqwest =0.13.4`, versão já transitiva no lock, com `blocking` e `native-tls-no-alpn`. Necessário para recuperar o GIF original quando o navegador fornece URL e um PNG estático no clipboard. TLS do sistema, leitura limitada, timeout, validação de URL/DNS/redirect, sem cookies ou credenciais; sem ampliar CSP nem depender de curl do host. Lock/TLS verificados; auditorias npm/Cargo e licenças PASS, com os 12 avisos Cargo preexistentes permitidos.
- Área de transferência de imagens (validada em Tauri/X11, Experimental, 2026-10-30): `arboard =3.7.0` com `wayland-data-control`, o provedor usado pelo plugin oficial do Tauri, compatível com os pins Tauri 2.11.5/Rust 1.97. Necessário porque Tauri/WebKitGTK recebeu `paste` com `types/files/items` vazios para PNG nativo. Uso direto somente para leitura permite recuperar também HTML com a URL original de GIFs: a API Rust do plugin compatível 2.3.3 não expõe essa leitura; 2.4+ exigiria Tauri ^2.12. Um IPC delimitado ao gesto de colar, fora da thread de UI, sem polling, escrita no clipboard, permissões JS amplas ou pacote npm. Pixels/origem entram no mesmo Photo2SGDK/writer/plano de paletas. Quinze passos nativos do fluxo e gates completos PASS. KDE abriu/fechou pelo atalho; colagem no desktop Wayland físico não qualificada por indisponibilidade do serviço de entrada de QA.
- Launcher Linux pós-reboot (correção2026-10-30): boot_id do kernel identifica leases de outra inicialização; mutex do host-manager e arquivo/recibo preservados. Notificação opcional `notify-send` já fornecida pelo host para `RDS_DESKTOP_LAUNCH=1`, sem pacote/dependência do app nem shell para o conteúdo. Sem boot confiável, a recuperação automática é recusada. Validação/limites no Memory Bank.
- QA nativo da entrada de imagens: o roteiro Tauri existente usa `scripts/image-clipboard-fixture.py` como produtor GTK3/PyGObject de clipboard e arraste do host Linux, com ImageMagick para uma representação HTML+PNG. Receita versionada, sem dependência Python/ImageMagick no aplicativo e sem um segundo harness de produto; imagens, projetos, ROMs e evidências permanecem no runtime privado.
- `tree-sitter` 0.25 + `tree-sitter-c` 0.24 (aprovado pelo operador em 2026-10-27) para o grafo C sem perdas de projetos SGDK importados (`core/sgdk_c_graph.rs`, Experimental): parser C real, round-trip byte-a-byte e build do C editado nos nodes

### Ferramentas aprovadas de validacao e processo
- `scripts/check-tree.cjs` para validar a estrutura raiz
- `eslint` para lint do frontend
- `npx tsc --noEmit` para typecheck do frontend
- `cargo clippy -- -D warnings` para lint do backend Rust
- `cargo-audit 0.22.2` como auditor de desenvolvimento/CI, sem entrar no runtime
- `cargo test --lib -- --nocapture` e `npm test` para suites automatizadas

### Ambiente de desenvolvimento reproduzivel

- Node.js `24.18.0` LTS e npm `11.16.0`, fixados por `.node-version`, `package.json` e lock do host.
- Rust `1.97.0` com Clippy/Rustfmt, fixado por `rust-toolchain.toml`; `src-tauri/Cargo.lock` e obrigatorio para esta aplicacao Tauri.
- SGDK `2.11`, PVSnesLib `4.5.0`, Libretro `1.22.2`, Ghidra `12.1`, JDK 21 e `tauri-driver 2.0.6` compoem o profile full.
- `toolchains/host-requirements.lock.json` fixa tags/commits e hashes. Execucao normal nao consulta `latest`.
- Binarios ativos, Cargo target e caches de compilacao vivem no filesystem nativo por lock digest; o cartao mantem codigo e cache portatil de downloads por SHA-256.
- Hosts v1: Windows 10/11 x64 e Arch/Manjaro/BigLinux x64. Outros hosts retornam `UNSUPPORTED` sem instalacao.
- npm opera com `strict-allow-scripts`; somente o `esbuild` fixado pode executar install script e `fsevents` e explicitamente negado.
- Override transitivo `brace-expansion` fixado em `5.0.12` (2026-09-30): patch das recusas de servico GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7 e GHSA-6j4f-fj2g-mc7p. Atualizacao de dependencia existente; nenhuma dependencia nova.
- Updater publico esta desabilitado ate existir certificado, canal, endpoint imutavel e politica de assinatura reais.

---

## 3. Regras Rigidas

1. Nao usar Electron.
2. Nao usar Python no runtime do app para `scene -> ROM`.
3. Nao gerar codigo C por concatenacao espaguete fora de AST/emitter estruturado.
4. Dependencias de terceiros nao devem ser commitadas no repositorio.
5. SDKs e cores devem ser baixados apenas do upstream oficial e mediante consentimento do usuario.
6. No Windows, o caminho SNES deve detectar e preferir Git Bash/MSYS2 real; nao usar o shim `C:\Windows\System32\bash.exe`.
7. Nenhum gate novo entra no CI sem reproduzir localmente o comando e corrigir os erros reais expostos.

---

## 4. Fluxo Macro Atual

1. Usuario clica em `Build & Run`.
2. Frontend consulta status de dependencias externas.
3. Se faltar SGDK/PVSnesLib ou core Libretro, o app oferece instalacao sob demanda.
4. Backend Rust le UGDM e gera workspace por target.
5. Toolchain oficial compila a ROM.
6. Backend carrega a ROM no core Libretro real.
7. Framebuffer vai para o frontend.

---

## 5. Observacoes de Estado

- O projeto segue com `Libretro API via FFI no Rust` como decisao arquitetural consolidada.
- O caminho SNES atual suporta o exporter simples validado no hardware profile atual; metasprites e combinacoes mais amplas continuam fora do baseline atual.
- O blocker institucional restante e a certificacao Windows no mesmo commit/lock, seguida por signing/updater/licencas de redistribuicao para qualquer release publico.
- O baseline de validacao local/CI inclui estrutura, Rustfmt, lint, typecheck, auditorias npm/RustSec, testes frontend e testes Rust.
- `scripts/host-manager.mjs` e o unico orquestrador de provisionamento. `src-tauri/src/tools/dependency_manager.rs` apenas projeta o report comum no Runtime Setup.
- Retomada em host vazio: `scripts/new-host.{sh,ps1,mjs}` apenas compoem os bootstraps/host-manager e comandos existentes, com Node built-ins e shells do OS; nenhuma dependencia nova. Ativacao local por processo, Cargo target compartilhado por lock, logs privados e jobs limitados. Ver `docs/handoffs/NOVO_HOST_INICIO.md`.
- Manutencao de dependencias de desenvolvimento em 2026-10-24: Vite `6.4.5`, Vitest/UI/Browser `4.1.12` e override Undici `7.30.1` para os advisories atuais; sem novo pacote de runtime, sem mudanca de major e sem excecao de auditoria. Lock e integridades regenerados; gates desta rodada devem ser lidos no relatorio de validacao, nao nos numeros historicos.
- Toolchains ativos vivem no cache nativo por lock digest; `toolchains/` no cartao guarda contrato, compatibilidade legada validada e cache portatil ignorado pelo Git.
- Bibliotecas Rust internas por path (`crates/<nome>`, sem workspace na raiz) hoje consumidas por `src-tauri/Cargo.toml`: `rex-addressing`, `rex-kosinski`, `rex-gameplay`, `rex-mugen` e `rex-enigma` (decoder Enigma puro, 0 dependencias externas, aprovado pelo operador em 2026-10-06 para a leitura somente-leitura dos layouts Sonic; Experimental). Nenhum crate externo novo; `Cargo.lock` ganha apenas a entrada local sem `source`.
- Modulos Rust internos genericos de Mega Drive, sem dependencia nova (2026-10-07; Experimental): `rex_nemesis` (decoder Nemesis puro, limites/cancelamento/erros estruturados) e `rex_mdgfx` (tiles 4bpp, pecas de mapping, CRAM, composicao indexada). Nao conhecem jogo algum; perfis (`sonic_ss_walls`) fornecem origem e prova. Candidatos a crate em `crates/` se um segundo consumidor aparecer.
- Tambem sem dependencia nova (2026-10-08; Experimental): `rex_sigscan` (localizador por assinatura de bytes com capturas) e `rex_platformer_jump` (+ adaptador `rex_jump_ipc`): perfil de pulo localizado por assinatura e constantes editaveis sem crescer a ROM.
