#!/usr/bin/env python3
"""Read host resources; certify only in the project-approved heavy-job window."""
import datetime,json,os,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
def memory():return {line.split(':',1)[0]:int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines()}
samples=[]
for i in range(3):
 mem=memory();samples.append({'available_kib':mem['MemAvailable'],'swap_used_kib':mem['SwapTotal']-mem['SwapFree']})
 if i<2:time.sleep(2)
swap_growing=all(samples[i+1]['swap_used_kib']>samples[i]['swap_used_kib'] for i in range(2))
heavy=[]
for proc in Path('/proc').iterdir():
 if not proc.name.isdigit():continue
 try:
  comm=(proc/'comm').read_text().strip()
  # Node24 and npm change their Linux comm/title while running. Inspect the
  # command for these names too; otherwise an active certify can be missed.
  if comm in ['node','npm','java','node-MainThread','MainThread'] or comm.startswith('npm '):
   command=(proc/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
   if 'host-manager.mjs certify' in command or 'e2e-tauri-build-run.mjs' in command or 'vitest run' in command or 'scripts/build.mjs' in command or 'Ghidra' in command:
    heavy.append({'pid':int(proc.name),'name':comm+' heavy validation/build'})
  if comm in ['mame','cargo','rustc','cc1','cc1plus','Ghidra','tauri-driver','WebKitWebDriver']:
   heavy.append({'pid':int(proc.name),'name':comm})
 except (FileNotFoundError,PermissionError,ProcessLookupError):pass
report={'schema':'rex-heavy-job-preflight/v1','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'minimum_available_kib':3*1024*1024,'available_kib':mem['MemAvailable'],'swap_used_kib':mem['SwapTotal']-mem['SwapFree'],'other_heavy_processes':heavy,'samples_two_seconds_apart':samples,'swap_growing_across_both_intervals':swap_growing,'ready_for_heavy_job':all(x['available_kib']>=3*1024*1024 for x in samples) and not swap_growing and not heavy,'source':'docs/rex_profiles/ROUND_STATE.md: before each heavy job; below about3GiB defer; one heavy job at a time'}
print(json.dumps(report,indent=2),flush=True)
if not report['ready_for_heavy_job']:raise SystemExit(75)
if sys.argv[1:]==['--certify']:
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 out=Path('/home/misael/rds-scratch/commercial_recovery_20261016')/('certify-'+stamp);out.mkdir(exist_ok=False)
 (out/'preflight.json').write_text(json.dumps(report,indent=2)+'\n')
 cmd=['rtk','npm','run','host:certify']
 with (out/'raw.log').open('w') as log:
  child=subprocess.Popen(cmd,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
  for line in child.stdout:log.write(line);log.flush();sys.stdout.write(line)
  rc=child.wait()
 readiness=ROOT/'src-tauri/target-test/validation/host-readiness.json'
 if readiness.exists():(out/'host-readiness.json').write_bytes(readiness.read_bytes())
 (out/'result.json').write_text(json.dumps({'command':cmd,'exit_code':rc,'scope':'certification only; does not close missing app/graphics evidence'},indent=2)+'\n')
 raise SystemExit(rc)
elif len(sys.argv)>1:raise SystemExit('usage: preflight.py [--certify]')
