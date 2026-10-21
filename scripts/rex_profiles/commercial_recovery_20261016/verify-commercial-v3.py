#!/usr/bin/env python3
"""Stream verification of a frozen external trace; no ROM bytes in the report."""
import collections,hashlib,json,sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
PIN='322a14830b8f3be05d59507ccf41c7a57ff8e835cd2727573943cd61d4c944d0'
ROM='c7da53a10c317f882f5bba93af31c3972fc1ded18d8507d4f3d5a06190c81ebb'
def digest(data):return hashlib.sha256(data).hexdigest()
def stream(p):
 with p.open() as f:
  for line in f:yield json.loads(line)
def verify(events,run_id,instrument):
 seq=0;lastframe=-1;lasttime=-1;last_cpu_time=-1;clock_regressions=[];entry=None;returned=False;copying=False;copied=False;plain=None;copy=None;nr=nw=0
 before=[None]*8128;seen_reads=bytearray();seen_writes=bytearray();down=collections.Counter();vdp=0;terminal=None;start=False
 for e in events:
  seq+=1
  assert e['seq']==seq,'sequence gap'
  assert e['run_id']==run_id and e['rom_sha256']==ROM and e['instrument_sha256']==instrument,'identity'
  assert e['temporal_domain']=='machine-attotime','time domain'
  if e['kind']=='vdp_memory_snapshot':
   assert e['address_space'] in ['md.vdp.vram','md.vdp.cram','md.vdp.registers'] and e['address']==0 and e['word_size']==2 and e['clock_context']=='read-only-native-save-item','native VDP domain'
  else:assert e['address_space']=='md.cpu.bus24','CPU bus domain'
  seconds,fraction=e['emulated_time'].replace(',','').split('.')
  t=int(seconds)*10**9+int(fraction)
  assert e['frame']>=lastframe,'frame reversal'
  kind=e['kind']
  if t<lasttime:clock_regressions.append({'seq':seq,'kind':kind,'delta_ns':t-lasttime})
  if kind in ['read','write','enigma_entry','enigma_return','copy_entry','copy_return']:
   assert t>=last_cpu_time,'CPU event time reversal'
   last_cpu_time=t
  lasttime=t;lastframe=e['frame']
  if seq==1:assert kind=='collection_start','missing start';start=True
  assert terminal is None,'events after terminal'
  if kind=='enigma_entry' and (e['a0'],e['a1'],e['d0']&65535,e['stack_top_long'])==(0x65432,0xff4000,0,0x1b6d8):entry=e
  if kind=='enigma_return':
   assert entry and e['a7']==entry['a7']+4 and e['a0']==0x65432+634,'unpaired return'
   returned=True
  if kind=='decompressed_snapshot':
   plain=bytes.fromhex(e['hex']);assert returned and len(plain)==4096 and digest(plain)==PIN,'decoded resource'
  if kind=='copy_entry':assert returned and plain is not None,'copy before decode';copying=True
  if kind=='copy_return':assert copying and nr==nw==4096,'incomplete copy';copied=True;copying=False
  if kind=='copy_snapshot':
   assert copied,'snapshot before copy exit'
   copy=bytes.fromhex(e['hex']);assert len(copy)==8128,'copy span'
  if kind in ('read','write'):
   addr=e['address'];mask=e['mask'];value=e['data'];pc=e['instruction_pc']
   lanes=[]
   if mask&0xff00:lanes.append((addr,(value>>8)&255))
   if mask&0xff:lanes.append((addr+1,value&255))
   if kind=='write' and not copying and not copied:
    for a,v in lanes:
     if 0xff1020<=a<0xff1020+8128:before[a-0xff1020]=v
   if copying and pc==0x1b6f8:
    assert mask in (0xff00,0xff) and len(lanes)==1,'copy width'
    a,v=lanes[0]
    if kind=='read':assert a==0xff4000+nr and v==plain[nr],'source address/data';nr+=1;seen_reads.append(v)
    else:assert a==0xff1020+(nw//64)*128+nw%64 and v==plain[nw],'destination address/data';nw+=1;seen_writes.append(v)
   if copied and kind=='read' and 0xff1020<=addr<0xff3000:down[pc]+=1
   if copied and kind=='write' and 0xc00000<=addr<=0xc00007:vdp+=1
  if kind=='collection_end':assert e['complete'] and e['dropped']==0,'loss';terminal=e
 assert start and terminal and terminal['frame']==1290,'incomplete episode'
 assert entry and returned and copied and copy is not None,'missing chain boundary'
 expected=before[:]
 for i,v in enumerate(plain):expected[(i//64)*128+i%64]=v
 assert all(v is not None for v in expected),'unknown pre-copy holes'
 predicted=bytes(expected)
 assert predicted==copy,'strided copy reference'
 return {'schema':'rex-commercial-chain-verification/v1','run_id':run_id,'events':seq,'clock_regressions':clock_regressions,'temporal_limit':'frame notifier and CPU callbacks have a 36 ns boundary regression; sequence preserves callback order, raw clock retained; no corrected global timestamp invented','decoded_sha256':digest(plain),'source_read_bytes':nr,'destination_written_bytes':nw,'copy_span_bytes':len(copy),'predicted_copy_sha256':digest(predicted),'observed_copy_sha256':digest(copy),'zeroed_holes_observed':all(v==0 for i,v in enumerate(before) if i%128>=64),'downstream_read_pcs':{hex(k):v for k,v in sorted(down.items())},'later_vdp_port_writes':vdp,'consumption_runtime':'MAME 0.289, prepared special-stage state','status':'PASS_BOUNDED_RESOURCE_DECODE_COPY','limits':['No app correspondence','VDP ports later in time do not establish the full graphical dataflow','No framebuffer or edited-ROM claim','copy_entry is before setup LEAs; memory access trace, not entry A0/A1, proves effective copy buffers']}
def mutation(events,case):
 changed=False
 for raw in events:
  e=dict(raw)
  if not changed:
   if case=='wrong-run':e['run_id']='another-run';changed=True
   elif case=='time-reversal' and e['kind']=='read' and e.get('instruction_pc')==0x1b6f8:e['emulated_time']='0000.000,000,000';changed=True
   elif case=='gap' and e['seq']==4:e['seq']+=1;changed=True
   elif case=='wrong-caller' and e['kind']=='enigma_entry' and e['a0']==0x65432:e['stack_top_long']+=2;changed=True
   elif case=='wrong-source' and e['kind']=='read' and e['instruction_pc']==0x1b6f8:e['address']+=2;changed=True
   elif case=='wrong-destination' and e['kind']=='write' and e['instruction_pc']==0x1b6f8:e['address']+=2;changed=True
   elif case=='wrong-value' and e['kind']=='write' and e['instruction_pc']==0x1b6f8:e['data']^=65535;changed=True
   elif case=='wrong-width' and e['kind']=='write' and e['instruction_pc']==0x1b6f8:e['mask']=65535;changed=True
   elif case=='missing-terminal' and e['kind']=='collection_end':changed=True;continue
   elif case=='loss' and e['kind']=='collection_end':e['dropped']=1;changed=True
  yield e
 assert changed,'mutation did not target an event'
def main():
 if len(sys.argv)!=3:raise SystemExit('usage: verify-commercial.py <private-run-dir> <fresh-output-json>')
 run=Path(sys.argv[1]);out=Path(sys.argv[2]);assert not out.exists(),'refuse overwrite'
 manifest=json.loads((run/'manifest.json').read_text());inst=manifest['env']['REX_INSTRUMENT_SHA'];events=run/'events.jsonl'
 result=verify(stream(events),manifest['id'],inst);negative={}
 for case in ['wrong-run','time-reversal','gap','wrong-caller','wrong-source','wrong-destination','wrong-value','wrong-width','missing-terminal','loss']:
  try:verify(mutation(stream(events),case),manifest['id'],inst)
  except (AssertionError,IndexError) as e:negative[case]={'rejected':True,'reason':str(e)}
  else:negative[case]={'rejected':False}
 result['negative_controls']=negative;assert all(e['rejected'] for e in negative.values()),'negative accepted'
 result['input_event_sha256']=digest(events.read_bytes());out.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))
if __name__=='__main__':main()
