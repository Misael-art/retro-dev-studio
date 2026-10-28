import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import type { ActionableDiagnostic } from "../diagnostics";

// ── Types (mirror do Rust) ────────────────────────────────────────────────────

export interface EmulatorCommandResult {
  ok: boolean;
  message: string;
  diagnostics?: ActionableDiagnostic[];
}

export interface EmulatorObservationResult {
  ok: boolean;
  message: string;
  rom_path: string;
  rom_size: number;
  /** SHA-256 dos bytes carregados no core nesta sessão (não do disco). */
  rom_sha256: string;
  /** SHA-256 do arquivo atualmente em `rom_path`; diagnóstico separado. */
  disk_file_sha256?: string | null;
  disk_matches_loaded: boolean;
  core_label: string;
  core_path: string;
  frames_run: number;
  framebuffer_width: number;
  framebuffer_height: number;
  framebuffer_sha256: string;
  non_black_pixels: number;
  framebuffer_rgba: number[];
}

export interface EmulatorMemoryResult {
  ok: boolean;
  data: number[];
  total_size: number;
}

export interface ReplayCommandResult {
  ok: boolean;
  message: string;
  replay_path: string;
  frames_recorded: number;
  framebuffer_match: boolean | null;
}

/** Payload do evento `emulator://frame` — pixels RGBA prontos para ImageData */
export interface FramePayload {
  width: number;
  height: number;
  rgba: number[]; // Uint8Array serializado como array JSON
  core_epoch?: number;
  rom_sha256?: string;
  frame_sequence?: number;
  frame_index?: number;
}

export type FramePresentation = { epoch: number; sequence: number };

/** Reject stale loads and reordered events without forbidding rewind. */
export function acceptsFrame(
  payload: FramePayload,
  epoch: number | null,
  romSha256: string | undefined,
  previous: FramePresentation | null
): boolean {
  return epoch !== null && romSha256 !== undefined
    && payload.core_epoch === epoch && payload.rom_sha256 === romSha256
    && Number.isSafeInteger(payload.frame_sequence) && (payload.frame_sequence ?? 0) > 0
    && (previous === null || previous.epoch !== epoch || payload.frame_sequence! > previous.sequence);
}

/** Subscribe without advancing the core, including while paused. */
export async function listenToFrames(onFrame: (payload: FramePayload) => void): Promise<UnlistenFn> {
  let active = true;
  const unlisten = await listen<FramePayload>("emulator://frame", (event) => {
    if (active) onFrame(event.payload);
  });
  return () => {
    if (!active) return;
    active = false;
    unlisten();
  };
}

/** Payload do evento `emulator://audio` — amostras PCM i16 stereo */
export interface AudioPayload {
  sample_rate: number;
  samples: number[];
}

export interface JoypadState {
  b: boolean;
  y: boolean;
  select: boolean;
  start: boolean;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean;
  x: boolean;
  l: boolean;
  r: boolean;
}

export const JOYPAD_DEFAULT: JoypadState = {
  b: false, y: false, select: false, start: false,
  up: false, down: false, left: false, right: false,
  a: false, x: false, l: false, r: false,
};

// ── IPC calls ─────────────────────────────────────────────────────────────────

export function emulatorLoadRom(romPath: string): Promise<EmulatorCommandResult> {
  return invoke<EmulatorCommandResult>("emulator_load_rom", { romPath });
}

export function emulatorRunFrame(): Promise<EmulatorCommandResult> {
  return invoke<EmulatorCommandResult>("emulator_run_frame");
}

export function emulatorRunFrames(frames: number): Promise<EmulatorCommandResult> {
  return invoke<EmulatorCommandResult>("emulator_run_frames", { frames });
}

export function emulatorObserve(): Promise<EmulatorObservationResult> {
  return invoke<EmulatorObservationResult>("emulator_observe");
}

export function emulatorSaveState(): Promise<EmulatorCommandResult> {
  return invoke<EmulatorCommandResult>("emulator_save_state");
}

export function emulatorLoadState(): Promise<EmulatorCommandResult> {
  return invoke<EmulatorCommandResult>("emulator_load_state");
}

export function emulatorRewindStep(): Promise<EmulatorCommandResult> {
  return invoke<EmulatorCommandResult>("emulator_rewind_step");
}

export function emulatorStartRecording(): Promise<ReplayCommandResult> {
  return invoke<ReplayCommandResult>("emulator_start_recording");
}

export function emulatorStopRecording(projectDir: string): Promise<ReplayCommandResult> {
  return invoke<ReplayCommandResult>("emulator_stop_recording", { projectDir });
}

export function emulatorPlayReplay(replayPath: string): Promise<ReplayCommandResult> {
  return invoke<ReplayCommandResult>("emulator_play_replay", { replayPath });
}

export function emulatorReadMemory(
  region: number,
  offset: number,
  length: number
): Promise<EmulatorMemoryResult> {
  return invoke<EmulatorMemoryResult>("emulator_read_memory", { region, offset, length });
}

/**
 * Resposta do backend a uma transição de joypad. `ok: true` = ACEITA (aplicada ao estado de joypad na
 * época certa), com a geração e o quadro em que foi aplicada. Aceitação NÃO é consumo: o core só lê o
 * joypad ao rodar um quadro (ver `emulatorInputObservation`).
 */
export interface EmulatorInputResult extends EmulatorCommandResult {
  epoch?: number;
  generation?: number | null;
  applied_at_frame?: number | null;
}

/** Uma transição aplicada no backend e o que o core fez com ela. */
export interface EmulatorInputTransition {
  generation: number;
  joypad: JoypadState;
  /** Quadros emulados concluídos quando foi aplicada. */
  applied_at_frame: number;
  /** Primeiro quadro em que o core leu o joypad com esta transição vigente (null: ainda não). */
  first_polled_frame: number | null;
  last_polled_frame: number | null;
  /** Substituída antes de qualquer quadro lê-la: o core NUNCA a viu. */
  superseded_unpolled: boolean;
}

export interface EmulatorInputObservation {
  epoch: number;
  frames_run: number;
  generation: number;
  transitions: EmulatorInputTransition[];
}

export function emulatorSendInput(
  joypad: JoypadState,
  sessionEpoch?: number
): Promise<EmulatorInputResult> {
  return invoke<EmulatorInputResult>("emulator_send_input", {
    joypad,
    sessionEpoch: sessionEpoch ?? null,
  });
}

/** Transições de joypad aplicadas na carga corrente e o que o core fez com cada uma. Só leitura. */
export function emulatorInputObservation(): Promise<EmulatorInputObservation> {
  return invoke<EmulatorInputObservation>("emulator_input_observation");
}

export function emulatorGetCoreEpoch(): Promise<number> {
  return invoke<number>("emulator_get_core_epoch");
}

export function emulatorStop(): Promise<EmulatorCommandResult> {
  return invoke<EmulatorCommandResult>("emulator_stop");
}

/**
 * Inicia o loop de renderização a 60fps.
 * Chama `emulator_run_frame` a cada ~16ms e escuta `emulator://frame` para
 * entregar cada frame ao callback `onFrame`.
 *
 * @returns função para parar o loop (chame ao desmontar o componente)
 */
export async function startFrameLoop(
  onFrame: (payload: FramePayload) => void,
  onError?: (message: string) => void
): Promise<() => void> {
  let running = true;
  let unlisten: UnlistenFn | null = null;

  unlisten = await listenToFrames(onFrame);

  function stop() {
    running = false;
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
  }

  function fail(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    stop();
    onError?.(message);
  }

  // Loop a ~60fps usando requestAnimationFrame via setTimeout
  async function tick() {
    if (!running) return;
    try {
      const result = await emulatorRunFrame();
      if (!running) return;
      if (!result.ok) {
        fail(result.message || "Falha ao executar frame do emulador.");
        return;
      }
    } catch (error) {
      fail(error);
      return;
    }
    setTimeout(tick, 16); // ~60fps
  }

  tick();

  return stop;
}

/**
 * Avança exatamente UM quadro emulado (pausa/passo): uma chamada `emulator_run_frame` e a espera do
 * quadro correspondente. Diferente de `startFrameLoop`, não reagenda nada — um evento de quadro
 * atrasado não pode fazer o passo executar um segundo quadro.
 */
export async function runSingleFrame(
  onFrame: (payload: FramePayload) => void,
  timeoutMs = 5000
): Promise<FramePayload> {
  let settle: ((payload: FramePayload) => void) | null = null;
  const arrived = new Promise<FramePayload>((resolve) => {
    settle = resolve;
  });
  let received = false;
  const unlisten = await listenToFrames((payload) => {
    if (received) return;
    received = true;
    onFrame(payload);
    settle?.(payload);
  });
  try {
    const result = await emulatorRunFrame();
    if (!result.ok) {
      throw new Error(result.message || "Falha ao executar frame do emulador.");
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Quadro executado sem apresentação dentro do prazo.")), timeoutMs);
    });
    try {
      return await Promise.race([arrived, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } finally {
    unlisten();
  }
}

/**
 * Observabilidade do encaminhamento de audio core → WebAudio. Separa o que o
 * core gerou (recebido), o que foi entregue ao grafo de saida do AudioContext
 * (renderizado) e o estado do contexto. Nao prova captura acustica/loopback.
 */
export type AudioOutputTelemetry = {
  receivedFrames: number;
  receivedNonZeroFrames: number;
  renderedFrames: number;
  renderedNonZeroFrames: number;
  renderedPeak: number;
  contextState: string | null;
  contextSampleRate: number | null;
  muted: boolean;
};

const audioOutputTelemetry: AudioOutputTelemetry = {
  receivedFrames: 0,
  receivedNonZeroFrames: 0,
  renderedFrames: 0,
  renderedNonZeroFrames: 0,
  renderedPeak: 0,
  contextState: null,
  contextSampleRate: null,
  muted: false,
};

export function recordAudioOutput(update: Partial<AudioOutputTelemetry> & {
  addReceived?: { frames: number; nonZero: number };
  addRendered?: { frames: number; nonZero: number; peak: number };
}): void {
  const { addReceived, addRendered, ...fields } = update;
  Object.assign(audioOutputTelemetry, fields);
  if (addReceived) {
    audioOutputTelemetry.receivedFrames += addReceived.frames;
    audioOutputTelemetry.receivedNonZeroFrames += addReceived.nonZero;
  }
  if (addRendered) {
    audioOutputTelemetry.renderedFrames += addRendered.frames;
    audioOutputTelemetry.renderedNonZeroFrames += addRendered.nonZero;
    audioOutputTelemetry.renderedPeak = Math.max(audioOutputTelemetry.renderedPeak, addRendered.peak);
  }
}

/** Last seconds of stereo samples received from the core, addressed by absolute index. */
const AUDIO_RING_CAPACITY = 44100 * 2 * 10;
const audioRing = new Int16Array(AUDIO_RING_CAPACITY);
let audioRingTotal = 0;
let audioRingSampleRate = 0;

export function recordReceivedAudioSamples(samples: ArrayLike<number>, sampleRate: number): void {
  audioRingSampleRate = sampleRate;
  for (let index = 0; index < samples.length; index += 1) {
    audioRing[(audioRingTotal + index) % AUDIO_RING_CAPACITY] = samples[index];
  }
  audioRingTotal += samples.length;
}

/** Samples [from, from+count) if still in the ring; `total` is the running sample count. */
export function readReceivedAudioSamples(from: number, count: number): { total: number; sampleRate: number; from: number; samples: number[] } {
  const start = Math.max(from, audioRingTotal - AUDIO_RING_CAPACITY, 0);
  const end = Math.min(start + count, audioRingTotal);
  const samples: number[] = [];
  for (let index = start; index < end; index += 1) samples.push(audioRing[index % AUDIO_RING_CAPACITY]);
  return { total: audioRingTotal, sampleRate: audioRingSampleRate, from: start, samples };
}

export function getAudioOutputTelemetry(): AudioOutputTelemetry {
  return { ...audioOutputTelemetry };
}

export async function listenToAudioStream(
  onAudio: (payload: AudioPayload) => void
): Promise<UnlistenFn> {
  return listen<AudioPayload>("emulator://audio", (event) => {
    onAudio(event.payload);
  });
}

// ── Keyboard → JoypadState mapping ───────────────────────────────────────────

export type JoypadPlatform = "megadrive" | "snes";

/**
 * Teclado → RetroPad. Os campos de `JoypadState` sao ids do RetroPad Libretro,
 * nao botoes do console. O Genesis Plus GX liga RetroPad Y→A, B→B e A→C do
 * Mega Drive (verificado com ROM SGDK real: so `y` aciona `BUTTON_A`), entao
 * Z/X/C precisam mirar Y/B/A para chegarem como A/B/C no jogo.
 */
const MEGADRIVE_KEY_MAP: Record<string, keyof JoypadState> = {
  ArrowUp:    "up",
  ArrowDown:  "down",
  ArrowLeft:  "left",
  ArrowRight: "right",
  KeyZ:       "y",    // Mega Drive A
  KeyX:       "b",    // Mega Drive B
  KeyC:       "a",    // Mega Drive C
  Enter:      "start",
  ShiftRight: "select",
};

/** SNES: RetroPad segue o layout nativo do controle. */
const SNES_KEY_MAP: Record<string, keyof JoypadState> = {
  ArrowUp:    "up",
  ArrowDown:  "down",
  ArrowLeft:  "left",
  ArrowRight: "right",
  KeyZ:       "a",
  KeyX:       "b",
  KeyC:       "y",
  Enter:      "start",
  ShiftRight: "select",
};

/** Botao do Mega Drive (como o SGDK o nomeia, sem o prefixo `BUTTON_`). */
export type MegadriveButton = "A" | "B" | "C" | "START" | "UP" | "DOWN" | "LEFT" | "RIGHT";

/** RetroPad → botao do Mega Drive, conforme o core Genesis Plus GX (ver comentario acima). */
const MEGADRIVE_RETROPAD_TO_BUTTON: Partial<Record<keyof JoypadState, MegadriveButton>> = {
  y: "A",
  b: "B",
  a: "C",
  start: "START",
  up: "UP",
  down: "DOWN",
  left: "LEFT",
  right: "RIGHT",
};

/**
 * Teclas do teclado que chegam ao jogo como `button` no Mega Drive. Derivado do mesmo
 * `MEGADRIVE_KEY_MAP` usado pela Game View, para a UI nunca divergir do core.
 */
export function megadriveKeyboardKeysForButton(button: MegadriveButton): string[] {
  return Object.entries(MEGADRIVE_KEY_MAP)
    .filter(([, retroPad]) => MEGADRIVE_RETROPAD_TO_BUTTON[retroPad] === button)
    .map(([key]) => key);
}

export function keyToJoypad(
  current: JoypadState,
  key: string,
  pressed: boolean,
  platform: JoypadPlatform = "megadrive"
): JoypadState | null {
  const button = (platform === "snes" ? SNES_KEY_MAP : MEGADRIVE_KEY_MAP)[key];
  if (!button) return null;
  return { ...current, [button]: pressed };
}

export interface EmulatorVramUsage {
  available: boolean;
  used_bytes: number;
  total_bytes: number;
}

/** Ocupação real da VRAM no core em execução (tiles com dados). */
export function emulatorVramUsage(): Promise<EmulatorVramUsage> {
  return invoke<EmulatorVramUsage>("emulator_vram_usage");
}

export interface RomSceneCapture {
  scene_path: string;
  scene_id: string;
  sprite_count: number;
  vram_used_bytes: number;
  width: number;
  height: number;
}

/** Grava a tela atual do jogo (planos e sprites do VDP) como cena do projeto. */
export function captureRomScene(projectDir: string, name: string): Promise<RomSceneCapture> {
  return invoke<RomSceneCapture>("capture_rom_scene", { projectDir, name });
}
