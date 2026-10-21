import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../../");
const dataDir = resolve(repoRoot, "data/rex_profiles/rea_lab_20261015");
const runRoot = "/home/misael/rds-scratch/rea_lab_20261015/runs";
const pinnedBin = "/home/misael/.cache/retrodevstudio/dd99a22faa05edc480ce06da3fe3651e7a79578a629959dcdbd8cd50ac011377/toolchains/m68k-elf/bin";
const sourcePath = resolve(dataDir, "semantic_gate_reversed_cmp_holdout.S");
const linkerScript = resolve(dataDir, "semantic_gate_reversed_cmp_holdout.ld");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const ensure = (condition, message) => { if (!condition) throw new Error(message); };

function run(program, args, outputPath = null) {
  const result = spawnSync(program, args, { cwd: process.cwd(), encoding: "utf8" });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) throw new Error(`${program} exited ${result.status}: ${output}`);
  if (outputPath) return writeFile(outputPath, output).then(() => output);
  return output;
}

function symbolsFrom(text) {
  const result = new Map();
  for (const line of text.split(/\r?\n/u)) {
    const match = line.match(/^\s*([0-9a-f]+)\s+(?:(?:([0-9a-f]+)\s+)?)([A-Za-z])\s+(\S+)\s*$/iu);
    if (match) result.set(match[4], {
      address: Number.parseInt(match[1], 16),
      size: match[2] ? Number.parseInt(match[2], 16) : 0,
      type: match[3].toUpperCase(),
    });
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const outputAt = args.indexOf("--output-dir");
  ensure(outputAt >= 0 && args[outputAt + 1], "usage: build-semantic-gate-holdout.mjs --output-dir <absolute-run-dir>");
  const outputDir = resolve(args[outputAt + 1]);
  ensure(outputDir.startsWith(`${runRoot}/`), `output directory must be below ${runRoot}`);
  await mkdir(outputDir, { recursive: true });
  const tools = {
    as: process.env.M68K_ELF_AS ?? resolve(pinnedBin, "m68k-elf-as"),
    ld: process.env.M68K_ELF_LD ?? resolve(pinnedBin, "m68k-elf-ld"),
    objcopy: process.env.M68K_ELF_OBJCOPY ?? resolve(pinnedBin, "m68k-elf-objcopy"),
    objdump: process.env.M68K_ELF_OBJDUMP ?? resolve(pinnedBin, "m68k-elf-objdump"),
    nm: process.env.M68K_ELF_NM ?? resolve(pinnedBin, "m68k-elf-nm"),
  };
  for (const program of Object.values(tools)) run(program, ["--version"]);
  const object = resolve(outputDir, "gate-reversed-cmp-holdout.o");
  const elf = resolve(outputDir, "gate-reversed-cmp-holdout.elf");
  const romPath = resolve(outputDir, "gate-reversed-cmp-holdout.bin");
  const symbolsPath = resolve(outputDir, "gate-reversed-cmp-holdout.nm.txt");
  const disassemblyPath = resolve(outputDir, "gate-reversed-cmp-holdout.objdump.txt");
  await run(tools.as, ["-m68000", "-o", object, sourcePath]);
  await run(tools.ld, ["-T", linkerScript, "-o", elf, object]);
  await run(tools.objcopy, ["-O", "binary", "--only-section=.image", elf, romPath]);
  const nm = await run(tools.nm, ["-S", "--defined-only", elf]);
  await writeFile(symbolsPath, nm);
  await run(tools.objdump, ["-D", "-b", "elf32-m68k", "-m", "m68k:68000", elf], disassemblyPath);

  const rom = await readFile(romPath);
  const symbols = symbolsFrom(nm);
  const expected = {
    rds_vertical_background_tiles: 128,
    rds_vertical_player_frames: 256,
    rds_vertical_background_map: 1120,
    rds_vertical_palette: 32,
    rds_vertical_game_rules: 18,
    rds_vertical_sound_event: 8,
  };
  const resourceRanges = {};
  const resourceParts = [];
  for (const [name, size] of Object.entries(expected)) {
    const symbol = symbols.get(name);
    ensure(symbol && symbol.size === size && ["R", "T"].includes(symbol.type), `resource symbol ${name} missing, wrong-sized, or not ROM-resident`);
    const bytes = rom.subarray(symbol.address, symbol.address + symbol.size);
    ensure(bytes.length === size, `${name} lies outside the image`);
    resourceRanges[name] = { address: `0x${symbol.address.toString(16)}`, bytes: size, sha256: sha256(bytes) };
    resourceParts.push(bytes);
  }
  const entry = symbols.get("gate_holdout_entry");
  const exit = symbols.get("gate_holdout_exit");
  ensure(entry?.address === 0x240 && exit?.address === 0x25e, "holdout symbols do not match the frozen addresses");
  ensure(rom.length === 0xa21, `holdout image size ${rom.length} != 2593`);
  ensure(rom.subarray(0x100, 0x104).toString("ascii") === "SEGA", "Genesis header marker absent");
  ensure(rom.readUInt16BE(0x248) === 0xba83, `reversed CMP bytes ${rom.subarray(0x248, 0x24a).toString("hex")} != BA83`);
  ensure(rom.readUInt16BE(0x24a) === 0x6f0a, `BLE bytes ${rom.subarray(0x24a, 0x24c).toString("hex")} != 6F0A`);

  const manifest = {
    schema: "rea-lab-semantic-gate-holdout-build/v1",
    freezeId: "REA-SEM-M68K-GATE-FREEZE-001",
    status: "post-freeze author transfer check; not blind or clean-room",
    sourceSha256: sha256(await readFile(sourcePath)),
    linkerScriptSha256: sha256(await readFile(linkerScript)),
    romSha256: sha256(rom),
    romBytes: rom.length,
    region: { entry: "0x240", exit: "0x25E" },
    comparison: { counterAddress: "0x00FF0200", stateAddress: "0x00FF0204", counterRegister: "D3", thresholdRegister: "D5", stateRegister: "D6", compare: "CMP.L D3,D5", compareBytes: "BA83", condition: "BLE", conditionBytes: "6F0A" },
    resourceRanges,
    resourceConcatSha256: sha256(Buffer.concat(resourceParts)),
    resetHarness: { resultStart: "0x00FF0300", resultCount: 7, inputOrder: ["0x80000000", "0xFFFFFFFF", "0x00000000", "0x00000004", "0x00000005", "0x00000006", "0x7FFFFFFF"] },
    tools,
    outputs: { rom: romPath, elf, object, symbols: symbolsPath, disassembly: disassemblyPath },
  };
  await writeFile(resolve(outputDir, "holdout-build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
