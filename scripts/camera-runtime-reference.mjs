#!/usr/bin/env node
// Cross-compiler diagnosis for the canonical camera template. Produces authored
// SDK probes, never a substitute for the Tauri configure/build/play journey.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
for (const key of ["reference-dir", "snes-build-dir", "sdk", "output"]) {
  if (!options[key] || options[key].startsWith("--")) throw new Error(`Missing --${key}`);
}
const templatePath = path.resolve(import.meta.dirname, "../src-tauri/src/compiler/camera_runtime_template.c");
const template = readFileSync(templatePath, "utf8");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
mkdirSync(options.output, { recursive: true });
const output = mkdtempSync(path.join(path.resolve(options.output), "camera-c-reference-"));
const build = path.join(output, "sdk-build");
cpSync(options["snes-build-dir"], build, { recursive: true });
const romName = readFileSync(path.join(build, "Makefile"), "utf8").match(/export ROMNAME\s*:=\s*([a-z\d_]+)/i)?.[1];
if (!romName) throw new Error("SDK donor has no safe ROMNAME");

const fields = ["rds_camera_x", "rds_camera_y", "rds_camera_base_x", "rds_camera_base_y", "rds_camera_active", "rds_camera_paused", "rds_camera_separated", "rds_cam_path_index", "rds_camera_room", "rds_cam_path_tick", "rds_cam_dx", "rds_cam_dy", "rds_cam_direction", "rds_cam_remainder", "rds_cam_offset_left[0]", "rds_cam_shake_left[0]"];
const manifest = { schema: "retrodev.camera_cross_compiler/v1", tier: "cpu_reference_diagnostic", template_sha256: hash(template), logical_width: 320, fields, cases: [] };
for (const file of readdirSync(options["reference-dir"]).filter(n => n.endsWith(".c")).sort()) {
  const name = file.slice(0, -2), original = readFileSync(path.join(options["reference-dir"], file), "utf8");
  const receipt = JSON.parse(readFileSync(path.join(options["reference-dir"], `${name}.json`), "utf8"));
  if (receipt.status !== "passed" || receipt.source_sha256 !== hash(original)) throw new Error(`Unverified reference ${name}`);
  const start = original.indexOf("// Camera v1."), dataStart = original.indexOf("static const RdsCameraRoom rds_cam_rooms"), dataEnd = original.indexOf("static s32 rds_cam_clamp"), main = original.indexOf("int main(void){"), end = original.lastIndexOf("return 0;");
  if (start < 0 || dataStart < start || dataEnd < dataStart || main < dataEnd || end < main) throw new Error(`Unexpected reference boundaries ${name}`);
  const prefix = original.slice(0, start) + template.replace("/* RDS_CAMERA_DATA */", original.slice(dataStart, dataEnd));
  const body = original.slice(main + "int main(void){".length, end);
  const line = body.indexOf("\n"), initialization = body.slice(0, line), actions = body.slice(line + 1);
  const cast = fields.map(field => `(s16)(${field})`);
  const host = `${prefix}\n#include <stdio.h>\n#include <stdlib.h>\nstatic void probe_record(void){printf("${fields.map(() => "%d").join(",")}\\n",${cast.join(",")});}\n#undef assert\n#define assert(expression) do { if (!(expression)) abort(); probe_record(); } while (0)\nint main(void){{${initialization}}{${actions}}return 0;}\n`;
  const hostFile = path.join(output, `${name}-host.c`), exe = path.join(output, `${name}-host`);
  writeFileSync(hostFile, host);
  execFileSync("cc", ["-std=c99", "-Wall", "-Wextra", "-Werror", hostFile, "-o", exe], { stdio: "inherit" });
  const expected = execFileSync(exe, [], { encoding: "utf8" }).trim().split("\n").map(row => row.split(",").map(Number));
  if (expected.length > 32 || expected.some(row => row.length !== fields.length || row.some(n => !Number.isFinite(n)))) throw new Error(`Bad host trace ${name}`);
  const sdkPrefix = prefix.replace("#include <assert.h>\n#include <stdint.h>\n", "#include <snes.h>\n").replace("typedef int16_t s16;typedef uint16_t u16;typedef int32_t s32;\n", "");
  const stores = cast.map((value, i) => `probe_samples[offset+${i}]=${value};`).join("");
  const source = `${sdkPrefix}\nstatic volatile u16 probe_count=0,probe_samples[${32 * fields.length}]={0};\nstatic void probe_record(void){u16 offset;if(probe_count>=32)return;offset=probe_count*${fields.length};${stores}probe_count++;}\n#define assert(expression) probe_record()\nint main(void){consoleInit();probe_count=0;{${initialization}}{${actions}}while(1){WaitForVBlank();}return 0;}\n`;
  writeFileSync(path.join(build, "src/main.c"), source);
  writeFileSync(path.join(output, `${name}-sdk.c`), source);
  execFileSync("make", ["-C", build, "--eval=.SECONDARY:", `PVSNESLIB_HOME=${path.resolve(options.sdk)}`], { stdio: "inherit" });
  for (const ext of ["sfc", "sym"]) cpSync(path.join(build, `${romName}.${ext}`), path.join(output, `${name}.${ext}`));
  if (existsSync(path.join(build, "src/main.asm"))) cpSync(path.join(build, "src/main.asm"), path.join(output, `${name}.asm`));
  manifest.cases.push({ name, source_sha256: hash(source), reference_source_sha256: receipt.source_sha256, rom: path.join(output, `${name}.sfc`), sym: path.join(output, `${name}.sym`), expected });
  writeFileSync(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`CAMERA_REFERENCE_BUILT ${name} ${expected.length} samples`);
}
console.log(`CAMERA_REFERENCE_MANIFEST ${path.join(output, "manifest.json")}`);
