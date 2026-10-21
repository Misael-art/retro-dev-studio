#!/usr/bin/env python3
"""Own one isolated Xvfb; run the canonical native UI journey serially."""
import hashlib
import json
import os
import select
import subprocess
import sys
import time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
SCRATCH=Path('/home/misael/rds-scratch/commercial_recovery_20261016')

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    assert len(sys.argv)==4,'spec freeze fresh-run-id'
    spec_path,freeze_path=map(Path,sys.argv[1:3]);ident=sys.argv[3]
    assert ident.startswith('m3-native-')
    f=json.loads(freeze_path.read_text())
    for file,digest in f['inputs'].items():assert sha(Path(file))==digest,f'identity:{file}'
    app=ROOT/'src-tauri/target-test/debug/retro-dev-studio'
    assert sha(app)==f['app_sha256'],'app identity'
    subprocess.run(['rtk','proxy','python3',str(ROOT/'scripts/rex_profiles/commercial_recovery_20261016/preflight.py')],cwd=ROOT,check=True)
    work=SCRATCH/ident;work.mkdir(exist_ok=False)
    xvfb=Path('/home/misael/.cache/retrodevstudio/qa-xvfb/21.1.24-1/Xvfb')
    assert sha(xvfb)=='5bfd315a8c7bc626d0b183d176e130c34f910a4a1279d9d53ea45769f62a3351'
    read_fd,write_fd=os.pipe();server=None;child=None
    result={'id':ident,'status':'FAIL','command':None,'app_sha256':sha(app),'spec_sha256':sha(spec_path),'freeze_sha256':sha(freeze_path),'system_display_modified':False}
    started=time.monotonic()
    with (work/'run.log').open('w') as log:
        try:
            server=subprocess.Popen(['rtk','proxy',str(xvfb),'-displayfd',str(write_fd),'-screen','0','1920x1080x24','-nolisten','tcp'],pass_fds=(write_fd,),stdout=log,stderr=log)
            os.close(write_fd)
            assert select.select([read_fd],[],[],10)[0],'Xvfb display budget'
            number=os.read(read_fd,128).decode().strip();assert number.isdigit(),'Xvfb display allocation'
            env=dict(os.environ,DISPLAY=':'+number,LIBGL_ALWAYS_SOFTWARE='1',WEBKIT_DISABLE_COMPOSITING_MODE='1',RDS_SEMANTIC_JOURNEY_SPEC=str(spec_path.resolve()))
            command=['rtk','proxy','node','scripts/e2e-tauri-build-run.mjs','--skip-build','--scenario','semantic-gate-journey','--app',str(app),'--tauri-driver','/home/misael/.cargo/bin/tauri-driver','--native-driver','/usr/sbin/WebKitWebDriver']
            result.update(command=command,display=env['DISPLAY'],xvfb_pid=server.pid)
            child=subprocess.Popen(command,cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT)
            result['runner_pid']=child.pid
            result['exit_code']=child.wait(timeout=600)
            result['status']='PASS_NATIVE_RUNNER' if result['exit_code']==0 else 'FAIL_NATIVE_RUNNER'
        except Exception as error:
            result['error']=str(error)
            if child and child.poll() is None:
                child.terminate()
                try:child.wait(timeout=15)
                except subprocess.TimeoutExpired:child.kill();child.wait()
        finally:
            os.close(read_fd)
            if server and server.poll() is None:
                server.terminate()
                try:server.wait(timeout=10)
                except subprocess.TimeoutExpired:server.kill();server.wait()
            result['owned_xvfb_alive']=bool(server and server.poll() is None)
            result['owned_runner_alive']=bool(child and child.poll() is None)
            result['elapsed_seconds']=time.monotonic()-started
            result['log_sha256']=sha(work/'run.log')
            (work/'run.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
    return 0 if result['status']=='PASS_NATIVE_RUNNER' else 1

if __name__=='__main__':raise SystemExit(main())
