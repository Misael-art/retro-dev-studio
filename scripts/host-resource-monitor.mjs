import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  statfsSync,
  writeSync,
  closeSync,
} from "node:fs";
import os, { cpus, totalmem } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const MiB = 1024 ** 2;
const GiB = 1024 ** 3;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const heavyPattern = /cargo|rustc|rustup|node|npm|vite|rollup|webpack|tauri|msbuild|cl\.exe|link\.exe|java|javac|ghidra|libretro|retrodev|emulator|cmake|ninja|make/i;
const secretPattern = /((?:--?)(?:token|secret|password|passwd|api[-_]?key|authorization|cookie|session)(?:=|\s+)|\b(?:[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|AUTHORIZATION|COOKIE)[A-Z0-9_]*)=)("[^"]*"|'[^']*'|[^\s&]+)/gi;

function usage() {
  return `Uso: node scripts/host-resource-monitor.mjs [opções]

Opções:
  --samples N                 Amostras finitas (padrão: 1; máximo: 360)
  --interval-seconds N        Intervalo de 15 a 30 s quando N > 1 (padrão: 20)
  --peak-mib N                Pico estimado de RAM adicional do trabalho
  --output-mib N              Saída persistente estimada
  --staging-mib N             Staging e verificação estimados
  --verification-mib N        Espaço adicional para verificação
  --target PATH               Volume persistente do destino previsto
  --temp PATH                 Volume temporário previsto (padrão: temp do SO)
  --out PATH                  JSONL em diretório externo ao checkout
  --include-command-lines     Incluir comandos concorrentes com segredos comuns redigidos
  --help                      Mostrar esta ajuda

Sem --out, grava em RDS_WORK_ROOT/sessions quando configurado; caso contrário,
emite JSONL somente no stdout. A ferramenta não inicia, encerra nem aprova builds.
`;
}

function parseArgs(argv) {
  const options = {
    samples: 1,
    intervalSeconds: 20,
    peakMiB: null,
    outputMiB: null,
    stagingMiB: null,
    verificationMiB: null,
    targetPath: process.env.RDS_WORK_ROOT || process.cwd(),
    tempPath: os.tmpdir(),
    outputPath: null,
    includeCommandLines: false,
    help: false,
  };
  const numeric = new Map([
    ["--samples", "samples"],
    ["--interval-seconds", "intervalSeconds"],
    ["--peak-mib", "peakMiB"],
    ["--output-mib", "outputMiB"],
    ["--staging-mib", "stagingMiB"],
    ["--verification-mib", "verificationMiB"],
  ]);
  const paths = new Map([
    ["--target", "targetPath"],
    ["--temp", "tempPath"],
    ["--out", "outputPath"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--help") {
      options.help = true;
      continue;
    }
    if (key === "--include-command-lines") {
      options.includeCommandLines = true;
      continue;
    }
    const name = numeric.get(key) ?? paths.get(key);
    if (!name || argv[index + 1] === undefined) throw new Error(`argumento_inválido:${key}`);
    const value = argv[++index];
    if (numeric.has(key)) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`valor_numérico_inválido:${key}`);
      options[name] = parsed;
    } else {
      options[name] = value;
    }
  }
  if (!Number.isInteger(options.samples) || options.samples < 1 || options.samples > 360) {
    throw new Error("samples_deve_ser_inteiro_entre_1_e_360");
  }
  if (options.samples > 1 && (options.intervalSeconds < 15 || options.intervalSeconds > 30)) {
    throw new Error("intervalo_deve_ser_15_a_30_segundos");
  }
  return options;
}

function isWithin(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function resolveOutputPath(options) {
  let outputPath = options.outputPath;
  if (!outputPath && process.env.RDS_WORK_ROOT) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    outputPath = path.join(process.env.RDS_WORK_ROOT, "sessions", `host-resource-monitor-${timestamp}-${process.pid}`, "host-resources.jsonl");
  }
  if (!outputPath) return null;
  outputPath = path.resolve(outputPath);
  if (isWithin(projectRoot, outputPath)) throw new Error("recibo_deve_ficar_fora_do_checkout");
  mkdirSync(path.dirname(outputPath), { recursive: true });
  return outputPath;
}

function readText(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function numberFrom(text, pattern) {
  const match = pattern.exec(text ?? "");
  return match ? Number(match[1]) : null;
}

function parsePsi(file) {
  const text = readText(file);
  if (!text) return null;
  const result = {};
  for (const line of text.trim().split(/\r?\n/)) {
    const [kind, ...pairs] = line.split(/\s+/);
    const values = {};
    for (const pair of pairs) {
      const [key, value] = pair.split("=", 2);
      if (value !== undefined && Number.isFinite(Number(value))) values[key] = Number(value);
    }
    result[kind] = values;
  }
  return result;
}

function readLinuxMemory() {
  const mem = readText("/proc/meminfo");
  const vmstat = readText("/proc/vmstat");
  const kb = (key) => numberFrom(mem, new RegExp(`^${key}:\\s+(\\d+)\\s+kB`, "m"));
  const pages = (key) => numberFrom(vmstat, new RegExp(`^${key}\\s+(\\d+)`, "m"));
  return {
    totalBytes: (kb("MemTotal") ?? Math.round(totalmem() / 1024)) * 1024,
    availableBytes: kb("MemAvailable") === null ? null : kb("MemAvailable") * 1024,
    swapTotalBytes: kb("SwapTotal") === null ? null : kb("SwapTotal") * 1024,
    swapFreeBytes: kb("SwapFree") === null ? null : kb("SwapFree") * 1024,
    swapCountersPages: { in: pages("pswpin"), out: pages("pswpout") },
  };
}

function readLinuxCpu() {
  const line = readText("/proc/stat")?.split(/\r?\n/).find((entry) => entry.startsWith("cpu "));
  if (!line) return null;
  const values = line.trim().split(/\s+/).slice(1).map(Number);
  const idle = (values[3] ?? 0) + (values[4] ?? 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  return { idle, total };
}

async function measureCpuPercent() {
  const totals = () => cpus().map((cpu) => {
    const times = cpu.times;
    return { idle: times.idle, total: times.user + times.nice + times.sys + times.idle + times.irq };
  });
  const before = totals();
  await delay(250);
  const after = totals();
  let idleDelta = 0;
  let totalDelta = 0;
  for (let index = 0; index < Math.min(before.length, after.length); index += 1) {
    idleDelta += after[index].idle - before[index].idle;
    totalDelta += after[index].total - before[index].total;
  }
  return totalDelta > 0 ? 100 * (1 - idleDelta / totalDelta) : null;
}

function readLinuxTemperatures() {
  const root = "/sys/class/thermal";
  try {
    return readdirSync(root).filter((name) => /^thermal_zone\d+$/.test(name)).map((name) => {
      const base = path.join(root, name);
      const currentText = readText(path.join(base, "temp"));
      const currentRaw = currentText === null ? null : Number(currentText.trim());
      const type = readText(path.join(base, "type"))?.trim() ?? name;
      const trips = {};
      for (const item of readdirSync(base).filter((entry) => /^trip_point_\d+_temp$/.test(entry))) {
        const index = item.match(/trip_point_(\d+)_temp/)?.[1];
        const value = Number(readText(path.join(base, item))?.trim());
        const tripType = readText(path.join(base, `trip_point_${index}_type`))?.trim()?.toLowerCase() ?? `trip_${index}`;
        if (Number.isFinite(value)) trips[tripType] = value / 1000;
      }
      return {
        id: name,
        type,
        currentC: Number.isFinite(currentRaw) ? currentRaw / 1000 : null,
        passiveTripC: trips.passive ?? null,
        criticalTripC: trips.critical ?? trips.hot ?? null,
        tripsC: trips,
      };
    });
  } catch {
    return null;
  }
}

function redactCommandLine(commandLine) {
  return String(commandLine ?? "")
    .replace(/(https?:\/\/)[^/@\s:]+:[^/@\s]+@/gi, "$1[REDACTED]@")
    .replace(secretPattern, "$1[REDACTED]")
    .replace(/\bBearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:token|secret|password|key|signature)=)[^&\s]+/gi, "$1[REDACTED]");
}

function readLinuxProcesses(includeCommandLines) {
  let entries;
  try {
    entries = readdirSync("/proc").filter((entry) => /^\d+$/.test(entry));
  } catch {
    return null;
  }
  const processes = [];
  for (const pid of entries) {
    const base = path.join("/proc", pid);
    const status = readText(path.join(base, "status"));
    const rssKiB = numberFrom(status, /^VmRSS:\s+(\d+)\s+kB/m);
    const name = readText(path.join(base, "comm"))?.trim() ?? "unknown";
    let commandLine = readText(path.join(base, "cmdline"))?.replaceAll("\0", " ").trim() ?? "";
    let executable = null;
    try {
      executable = readlinkSync(path.join(base, "exe"));
    } catch {
      // Process can exit or be hidden by procfs permissions between reads.
    }
    if (!rssKiB || (!heavyPattern.test(`${name} ${commandLine} ${executable ?? ""}`) && rssKiB < 128 * 1024)) continue;
    processes.push({
      pid: Number(pid),
      name,
      rssBytes: rssKiB * 1024,
      executable: executable ? path.basename(executable) : null,
      ...(includeCommandLines ? { commandLine: redactCommandLine(commandLine) } : {}),
    });
  }
  processes.sort((left, right) => right.rssBytes - left.rssBytes);
  return processes.slice(0, 30);
}

const windowsProbe = String.raw`
$ErrorActionPreference = 'Stop'
$cpu = $null
$memory = $null
$pagingFile = $null
$disk = $null
$counterErrors = @()
try { $cpu = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'" -ErrorAction Stop } catch { $counterErrors += 'cpu_counter_unavailable' }
try { $memory = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory -ErrorAction Stop } catch { $counterErrors += 'memory_counter_unavailable' }
try { $pagingFile = Get-CimInstance Win32_PerfFormattedData_PerfOS_PagingFile -Filter "Name='_Total'" -ErrorAction Stop } catch { $counterErrors += 'pagefile_counter_unavailable' }
try { $disk = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name='_Total'" -ErrorAction Stop } catch { $counterErrors += 'disk_counter_unavailable' }
$result = [pscustomobject]@{
  cpuPercent = if ($null -ne $cpu) { [double]$cpu.PercentProcessorTime } else { $null }
  availableMiB = if ($null -ne $memory) { [double]$memory.AvailableMBytes } else { $null }
  pagesInputPerSec = if ($null -ne $memory) { [double]$memory.PagesInputPerSec } else { $null }
  pagesOutputPerSec = if ($null -ne $memory) { [double]$memory.PagesOutputPerSec } else { $null }
  pageFileUsagePercent = if ($null -ne $pagingFile) { [double]$pagingFile.PercentUsage } else { $null }
  pageFileUsagePeakPercent = if ($null -ne $pagingFile) { [double]$pagingFile.PercentUsagePeak } else { $null }
  avgDiskSecondsPerTransfer = if ($null -ne $disk) { [double]$disk.AvgDisksecPerTransfer } else { $null }
  diskQueueLength = if ($null -ne $disk) { [double]$disk.CurrentDiskQueueLength } else { $null }
  diskBytesPerSec = if ($null -ne $disk) { [double]$disk.DiskBytesPersec } else { $null }
  counterErrors = @($counterErrors)
}
[Console]::WriteLine(($result | ConvertTo-Json -Compress -Depth 5))
`;

const windowsProcessProbe = String.raw`
$ErrorActionPreference = 'Stop'
$processes = @(Get-Process | ForEach-Object {
  $rss = [long]$_.WorkingSet64
  if ($rss -ge 134217728 -or $_.ProcessName -match '(?i)cargo|rustc|rustup|node|npm|vite|webpack|tauri|msbuild|cl|link|java|javac|ghidra|libretro|retrodev|emulator|cmake|ninja|make') {
    $leaf = $null
    try { if ($_.Path) { $leaf = Split-Path -Leaf $_.Path } } catch { }
    [pscustomobject]@{ pid=[int]$_.Id; name=$_.ProcessName; rssBytes=$rss; executable=$leaf }
  }
}) | Sort-Object rssBytes -Descending | Select-Object -First 30
$bios = $null
try { $bios = Get-ItemProperty -Path 'HKLM:\HARDWARE\DESCRIPTION\System\BIOS' -ErrorAction Stop } catch { }
$modelParts = @($bios.SystemProductName, $bios.BaseBoardProduct) | Where-Object { $_ }
[Console]::WriteLine(([pscustomobject]@{ processes=@($processes); model=($modelParts -join ' / ') } | ConvertTo-Json -Compress -Depth 4))
`;

const windowsThermalProbe = String.raw`
$ErrorActionPreference = 'Stop'
function To-Celsius($Value) { if ($null -eq $Value) { return $null }; return ([double]$Value / 10.0) - 273.15 }
$zones = @(Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | ForEach-Object {
  [pscustomobject]@{ id=$_.InstanceName; currentC=(To-Celsius $_.CurrentTemperature); passiveTripC=(To-Celsius $_.PassiveTripPoint); criticalTripC=(To-Celsius $_.CriticalTripPoint); activeTripC=(To-Celsius $_.ActiveTripPoint) }
})
[Console]::WriteLine(([pscustomobject]@{ thermalZones=$zones } | ConvertTo-Json -Compress -Depth 4))
`;

const windowsCommandProbe = String.raw`
$ErrorActionPreference = 'Stop'
function Redact([string]$Value) {
  if (-not $Value) { return $null }
  $Value = $Value -replace '(?i)(https?://)[^/@\s:]+:[^/@\s]+@', '$1[REDACTED]@'
  $Value = $Value -replace '(?i)(--?(?:token|secret|password|passwd|api[-_]?key|authorization|cookie|session)(?:=|\s+))("[^"]*"|''[^'']*''|[^\s&]+)', '$1[REDACTED]'
  $Value = $Value -replace '(?i)(\b(?:[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|AUTHORIZATION|COOKIE)[A-Z0-9_]*)=)("[^"]*"|''[^'']*''|[^\s&]+)', '$1[REDACTED]'
  $Value = $Value -replace '(?i)\bBearer\s+[^\s]+', 'Bearer [REDACTED]'
  $Value = $Value -replace '(?i)([?&](?:token|secret|password|key|signature)=)[^&\s]+', '$1[REDACTED]'
  return $Value
}
$processes = @(Get-CimInstance Win32_Process | ForEach-Object {
  $rss = [long]$_.WorkingSetSize
  if ($rss -ge 134217728 -or $_.Name -match '(?i)cargo|rustc|rustup|node|npm|vite|webpack|tauri|msbuild|cl\.exe|link\.exe|java|javac|ghidra|libretro|retrodev|emulator|cmake|ninja|make') {
    [pscustomobject]@{ pid=[int]$_.ProcessId; commandLine=(Redact ([string]$_.CommandLine)) }
  }
})
[Console]::WriteLine(([pscustomobject]@{ processes=$processes } | ConvertTo-Json -Compress -Depth 4))
`;

function runWindowsPowerShell(script, timeout) {
  const powershell = [
    path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
    "pwsh.exe",
  ].find((candidate) => candidate === "pwsh.exe" || existsSync(candidate));
  if (!powershell) return { error: "powershell_unavailable" };
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const result = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
    encoding: "utf8",
    timeout,
    maxBuffer: 8 * MiB,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const details = [result.error?.code, result.error?.message, result.stderr].filter(Boolean).join(" ");
    const error = /ETIMEDOUT/.test(details) ? "powershell_timeout"
      : /0x80041003|PermissionDenied|Access is denied/i.test(details) ? "wmi_access_denied"
        : /0x80041010|InvalidClass/i.test(details) ? "wmi_class_unavailable"
          : "powershell_probe_failed";
    return { error };
  }
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    return { error: "powershell_json_invalid" };
  }
}

function readWindowsSnapshot(includeCommandLines) {
  const base = runWindowsPowerShell(windowsProbe, 15000);
  const processResult = runWindowsPowerShell(windowsProcessProbe, 8000);
  const thermal = runWindowsPowerShell(windowsThermalProbe, 5000);
  const errors = [
    ...(base.error ? [{ probe: "performance_counters", error: base.error }] : []),
    ...(processResult.error ? [{ probe: "process_inventory", error: processResult.error }] : []),
    ...(thermal.error ? [{ probe: "thermal_sensors", error: thermal.error }] : []),
    ...(base.counterErrors ?? []).map((error) => ({ probe: "performance_counter", error })),
  ];
  let processes = Array.isArray(processResult.processes) ? processResult.processes : null;
  if (includeCommandLines && Array.isArray(processes)) {
    const commands = runWindowsPowerShell(windowsCommandProbe, 10000);
    if (commands.error) errors.push({ probe: "process_command_lines", error: commands.error });
    const byPid = new Map((commands.processes ?? []).map((entry) => [entry.pid, entry.commandLine]));
    processes = processes.map((entry) => ({
      ...entry,
      commandLine: redactCommandLine(byPid.get(entry.pid) ?? ""),
    }));
  }
  return {
    ...base,
    model: processResult.model ?? null,
    thermalZones: thermal.thermalZones ?? null,
    processes,
    errors,
  };
}

function readLinuxModel() {
  const product = readText("/sys/devices/virtual/dmi/id/product_name")?.trim();
  const board = readText("/sys/devices/virtual/dmi/id/board_name")?.trim();
  return [product, board].filter(Boolean).join(" / ") || os.type();
}

function readDisk(pathname) {
  try {
    const stat = statfsSync(pathname);
    const blockSize = Number(stat.bsize || stat.frsize);
    return {
      path: pathname,
      totalBytes: Number(stat.blocks) * blockSize,
      freeBytes: Number(stat.bavail) * blockSize,
      availableBytes: Number(stat.bavail) * blockSize,
    };
  } catch (error) {
    return { path: pathname, status: "unavailable", error: error.code ?? error.message };
  }
}

function assess(sample, options) {
  const reserveMiB = Math.max(4096, Math.ceil((sample.memory.totalBytes ?? totalmem()) / MiB * 0.25));
  const memoryStatus = options.peakMiB === null || sample.memory.availableBytes === null || sample.memory.availableSource === "node_os_freemem_fallback"
    ? "unknown"
    : sample.memory.availableBytes / MiB >= options.peakMiB + reserveMiB ? "pass" : "blocked";
  const diskEstimateComplete = options.outputMiB !== null && options.stagingMiB !== null && options.verificationMiB !== null;
  const requiredPersistentMiB = diskEstimateComplete
    ? 10240 + options.outputMiB + options.stagingMiB + options.verificationMiB
    : null;
  const requiredTemporaryMiB = diskEstimateComplete ? options.stagingMiB + options.verificationMiB : null;
  const targetFreeMiB = sample.storage.target.availableBytes === undefined ? null : sample.storage.target.availableBytes / MiB;
  const tempFreeMiB = sample.storage.temporary.availableBytes === undefined ? null : sample.storage.temporary.availableBytes / MiB;
  const diskStatus = !diskEstimateComplete || targetFreeMiB === null || tempFreeMiB === null
    ? "unknown"
    : targetFreeMiB >= requiredPersistentMiB && tempFreeMiB >= requiredTemporaryMiB ? "pass" : "blocked";

  const temperatures = sample.thermal.sensors ?? [];
  const currentC = temperatures.map((sensor) => sensor.currentC).filter(Number.isFinite);
  const passiveTrips = temperatures.map((sensor) => sensor.passiveTripC).filter(Number.isFinite);
  const maxCurrentC = currentC.length ? Math.max(...currentC) : null;
  const nearestPassiveC = passiveTrips.length ? Math.min(...passiveTrips) : null;
  const jupiterLimit = /jupiter|steam\s*deck/i.test(sample.host.model ?? "");
  const thermalStatus = maxCurrentC === null
    ? "unknown"
    : (jupiterLimit && maxCurrentC >= 90) || (nearestPassiveC !== null && nearestPassiveC - maxCurrentC < 10)
      ? "blocked"
      : nearestPassiveC === null && !jupiterLimit ? "unknown" : "pass";

  const gates = { memory: memoryStatus, disk: diskStatus, thermal: thermalStatus };
  const overall = Object.values(gates).includes("blocked")
    ? "BLOCKED"
    : Object.values(gates).includes("unknown") ? "INCOMPLETE" : "PASS_FOR_ESTIMATED_RESOURCES_ONLY";
  return {
    reserveMiB,
    estimatedPeakMiB: options.peakMiB,
    estimatedOutputMiB: options.outputMiB,
    estimatedStagingMiB: options.stagingMiB,
    estimatedVerificationMiB: options.verificationMiB,
    requiredPersistentFreeMiB: requiredPersistentMiB,
    requiredTemporaryFreeMiB: requiredTemporaryMiB,
    nearestPassiveTripC: nearestPassiveC,
    maxObservedTemperatureC: maxCurrentC,
    jupiter90CGuard: jupiterLimit,
    gates,
    overall,
    hostReadiness: "NOT_EVALUATED_USE_HOST_MANAGER",
    pressurePolicy: "Review PSI/paging/I-O samples and concurrent processes; this tool does not classify sustained pressure or stop other tasks.",
  };
}

async function sampleHost(index, previous, options) {
  const startedAtMs = Date.now();
  const now = new Date().toISOString();
  const windows = process.platform === "win32" ? readWindowsSnapshot(options.includeCommandLines) : null;
  const linuxMemory = process.platform === "linux" ? readLinuxMemory() : null;
  const cpu = process.platform === "linux" ? readLinuxCpu() : null;
  const memoryTotalBytes = totalmem();
  const memoryAvailableBytes = process.platform === "win32"
    ? windows?.availableMiB !== null && windows?.availableMiB !== undefined ? windows.availableMiB * MiB : os.freemem()
    : linuxMemory?.availableBytes ?? null;
  const memoryAvailableSource = process.platform === "win32"
    ? windows?.availableMiB !== null && windows?.availableMiB !== undefined ? "windows_memory_counter_available_mbytes" : "node_os_freemem_fallback"
    : linuxMemory?.availableBytes === null ? "unavailable_memavailable" : "proc_memavailable";
  const tempSensors = process.platform === "linux" ? readLinuxTemperatures() : windows?.thermalZones ?? null;
  const target = readDisk(options.targetPath);
  const temporary = readDisk(options.tempPath);
  const swapDelta = linuxMemory && previous?.linuxSwapCounters ? {
    inPages: linuxMemory.swapCountersPages.in === null ? null : linuxMemory.swapCountersPages.in - previous.linuxSwapCounters.in,
    outPages: linuxMemory.swapCountersPages.out === null ? null : linuxMemory.swapCountersPages.out - previous.linuxSwapCounters.out,
    intervalSeconds: previous?.sampledAtMs ? (startedAtMs - previous.sampledAtMs) / 1000 : null,
  } : null;
  const currentCpuPercent = process.platform === "win32"
    ? windows?.cpuPercent ?? await measureCpuPercent()
    : cpu && previous?.linuxCpu && cpu.total > previous.linuxCpu.total
      ? 100 * (1 - (cpu.idle - previous.linuxCpu.idle) / (cpu.total - previous.linuxCpu.total))
      : null;
  const availablePsi = process.platform === "linux" ? {
    cpu: parsePsi("/proc/pressure/cpu"),
    memory: parsePsi("/proc/pressure/memory"),
    io: parsePsi("/proc/pressure/io"),
  } : { cpu: null, memory: null, io: null };
  const sample = {
    schema: "retrodevstudio-host-resource-sample/v1",
    index,
    timestampUtc: now,
    host: {
      platform: process.platform,
      arch: process.arch,
      model: windows?.model ?? readLinuxModel(),
      cpuCount: cpus().length,
      loadAverage: process.platform === "win32" ? null : os.loadavg(),
    },
    cpu: {
      utilizationPercent: currentCpuPercent,
      utilizationSource: process.platform === "win32" && windows?.cpuPercent == null ? "node_cpu_time_delta_fallback" : process.platform === "win32" ? "windows_performance_counter" : "proc_stat_delta",
    },
    memory: {
      totalBytes: memoryTotalBytes,
      availableBytes: memoryAvailableBytes,
      availableSource: memoryAvailableSource,
      swapTotalBytes: linuxMemory?.swapTotalBytes ?? null,
      swapFreeBytes: linuxMemory?.swapFreeBytes ?? null,
      pageFileUsagePercent: windows?.pageFileUsagePercent ?? null,
      pageFileUsagePeakPercent: windows?.pageFileUsagePeakPercent ?? null,
    },
    paging: process.platform === "win32" ? {
      pagesInputPerSec: windows?.pagesInputPerSec ?? null,
      pagesOutputPerSec: windows?.pagesOutputPerSec ?? null,
      note: "Windows performance counters; includes hard page activity and is not a pagefile-only measure.",
    } : null,
    swapActivity: swapDelta,
    pressure: availablePsi,
    io: windows ? {
      avgDiskSecondsPerTransfer: windows.avgDiskSecondsPerTransfer ?? null,
      queueLength: windows.diskQueueLength ?? null,
      bytesPerSec: windows.diskBytesPerSec ?? null,
      status: [windows.avgDiskSecondsPerTransfer, windows.diskQueueLength, windows.diskBytesPerSec].some(Number.isFinite) ? "observed" : "unavailable",
    } : null,
    storage: { target, temporary },
    thermal: {
      sensors: tempSensors,
      status: tempSensors === null ? "unavailable" : tempSensors.length ? "observed" : "no_sensors_returned",
    },
    concurrentProcesses: process.platform === "linux"
      ? readLinuxProcesses(options.includeCommandLines)
      : windows?.processes ?? null,
    probeErrors: windows?.errors ?? [],
  };
  sample.resourceAssessment = assess(sample, options);
  return {
    sample,
    nextState: {
      sampledAtMs: startedAtMs,
      linuxCpu: cpu,
      linuxSwapCounters: linuxMemory?.swapCountersPages ?? null,
    },
  };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  if (process.platform !== "win32" && process.platform !== "linux") {
    throw new Error(`host_platform_not_supported:${process.platform}`);
  }
  const outputPath = resolveOutputPath(options);
  const start = new Date().toISOString();
  let descriptor = null;
  if (outputPath) descriptor = openSync(outputPath, "wx");
  let previous = null;
  let nextSampleStartAt = Date.now();
  let previousSampleStartAt = null;
  for (let index = 0; index < options.samples; index += 1) {
    if (index > 0) {
      const waitMs = nextSampleStartAt - Date.now();
      if (waitMs > 0) await delay(waitMs);
    }
    const sampleStartedAt = Date.now();
    const result = await sampleHost(index + 1, previous, options);
    result.sample.collectionDurationMs = Date.now() - sampleStartedAt;
    result.sample.intervalSincePreviousMs = previousSampleStartAt === null ? null : sampleStartedAt - previousSampleStartAt;
    result.sample.monitorCadence = result.sample.intervalSincePreviousMs === null
      ? "not_applicable"
      : result.sample.intervalSincePreviousMs <= 30000 ? "within_30_seconds" : "missed_30_second_window";
    previous = result.nextState;
    previousSampleStartAt = sampleStartedAt;
    nextSampleStartAt = sampleStartedAt + options.intervalSeconds * 1000;
    const line = `${JSON.stringify(result.sample)}\n`;
    if (descriptor === null) process.stdout.write(line);
    else writeSync(descriptor, line, null, "utf8");
  }
  const summary = {
    schema: "retrodevstudio-host-resource-summary/v1",
    startedAtUtc: start,
    finishedAtUtc: new Date().toISOString(),
    sampleCount: options.samples,
    maxSamplesPerRun: 360,
    outputPath,
    retentionPolicy: "operator_managed_no_auto_delete",
    hostReadiness: "NOT_EVALUATED_USE_HOST_MANAGER",
  };
  if (descriptor === null) process.stdout.write(`${JSON.stringify(summary)}\n`);
  else {
    writeSync(descriptor, `${JSON.stringify(summary)}\n`, null, "utf8");
    closeSync(descriptor);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message ?? error}\n${usage()}`);
  process.exitCode = 1;
});
