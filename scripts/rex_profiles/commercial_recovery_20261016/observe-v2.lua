-- External MAME-only instrument. No production core/API changes.
local mach=manager.machine
local cpu=mach.devices[':maincpu']
local sp=cpu.spaces['program']
local dbg=assert(mach.debugger, 'debugger required')
local run=assert(os.getenv('REX_RUN_ID'))
local rom=assert(os.getenv('REX_ROM_SHA'))
local inst=assert(os.getenv('REX_INSTRUMENT_SHA'))
local output_path=assert(os.getenv('REX_EVENTS'))
local existing=io.open(output_path,'rb')
if existing then existing:close();error('refusing existing event file') end
local out=assert(io.open(output_path,'wb'))
local maxevents=tonumber(os.getenv('REX_MAX_EVENTS') or '250000')
local mode=os.getenv('REX_MODE') or 'author'
local frames=0
local seq=0
local dropped=0
local clock_context='ui-debugger-coroutine'
local observing=false
local capture_active=mode=='author'
local taps={}
local breaks={}
local break_ids={}
local sprite_hits=0
local sub
local function reg(name)
 if name=='A7' then name='SP' end
 return assert(cpu.state[name],name).value
end
local function event(kind, fields)
  if seq>=maxevents and kind~='collection_end' then dropped=dropped+1; return end
  seq=seq+1
  out:write(string.format('{"run_id":"%s","rom_sha256":"%s","instrument_sha256":"%s","runtime":"MAME","seq":%d,"frame":%d,"emulated_time":"%s","temporal_domain":"machine-attotime","address_space":"md.cpu.bus24","kind":"%s","clock_context":"%s"%s}\n',run,rom,inst,seq,frames,tostring(mach.time),kind,clock_context,fields or ''))
 out:flush()
end
local function tap(kind,start,last)
 print('REX SET TAP '..kind..' '..start);io.stdout:flush()
 local fn=function(addr,data,mask)
  local prior_context=clock_context
  clock_context='cpu-program-memory-tap'
  if observing or not capture_active or mach:side_effects_disabled() then clock_context=prior_context;return end
  event(kind,string.format(',"address":%d,"data":%d,"mask":%d,"pc_context":%d,"instruction_pc":%d',addr,data,mask,reg('PC'),reg('CURPC')))
  clock_context=prior_context
 end
 if kind=='read' then taps[#taps+1]=sp:install_read_tap(start,last,'rex_'..kind..start,fn)
 else taps[#taps+1]=sp:install_write_tap(start,last,'rex_'..kind..start,fn) end
end
local function snapshot(addr,n,kind)
 observing=true
 local data={}
 for i=0,n-1 do data[#data+1]=string.format('%02x',sp:read_u8(addr+i)) end
 observing=false
 event(kind,string.format(',"address":%d,"hex":"%s"',addr,table.concat(data)))
end
local function capture_screens()
 local screens=0
   for tag,screen in pairs(mach.screens) do
    screens=screens+1
    local stem=os.getenv('REX_SNAP_DIR')..'/frame-'..frames..'-screen'..screens
    local error=screen:snapshot(stem..'.png')
    local pixels,width,height=screen:pixels()
    local presented=mach.video:snapshot_pixels()
    local sw,sh=mach.video:snapshot_size()
    local snap_file=assert(io.open(stem..'.snapshot.pixels','wb'));snap_file:write(presented);snap_file:close()
    event('presented_snapshot',string.format(',"width":%d,"height":%d,"pixel_bytes":%d,"surface":"video.snapshot_pixels; rendered snapshot target, separate from active screen bitmap"',sw,sh,#presented))
    local f=assert(io.open(stem..'.pixels','wb'));f:write(pixels);f:close()
    local lut={}
    local indexed=screen.palette~=nil
    for offset=1,#pixels,4 do
     local value=string.unpack('I4',pixels,offset)
     if lut[value]==nil then
      lut[value]=indexed and screen.palette.palette:entry_adjusted_color(value) or value
     end
    end
    local entries={}
    for value,color in pairs(lut) do entries[#entries+1]=string.format('"%d":%d',value,color) end
    local palette_file=assert(io.open(stem..'.palette.json','wb'))
    palette_file:write('{"format":"'..(indexed and 'indexed32_host_endian' or 'rgb32_host_endian')..'","colors":{'..table.concat(entries,',')..'}}\n');palette_file:close()
    event('screen_capture',string.format(',"screen_tag":"%s","width":%d,"height":%d,"pixel_bytes":%d,"png_written":%s',tag,width,height,#pixels,error==nil and 'true' or 'false'))
   end
   event('screen_count',string.format(',"count":%d',screens))
end
local function breakpoint(addr,label)
 print('REX SET BREAKPOINT '..label);io.stdout:flush()
 local cond='1'
 if label=='entry' and mode=='author' then cond=string.format('d@sp==%x',tonumber(os.getenv('REX_RETURN'))) end
 if label=='sprite_loop_head' then cond='d@sp==1b268' end
 break_ids[addr]=cpu.debug:bpset(addr,cond,'')
 print('REX SET BREAKPOINT OK '..label);io.stdout:flush()
 breaks[addr]=label
end
if mode=='author' then
 breakpoint(0x300,'entry')
 breakpoint(tonumber(assert(os.getenv('REX_RETURN'))),'return')
 tap('read',0x500,0x51f)
 tap('write',0xff0200,0xff030f)
else
 breakpoint(0x171e,'enigma_entry')
 breakpoint(0x1b6d8,'enigma_return')
 breakpoint(0x1b6e8,'copy_entry')
 breakpoint(0x1b706,'copy_return')
 breakpoint(0xd762,'sprite_loop_head')
 cpu.debug:bpdisable(break_ids[0xd762])
 tap('read',0x65432,0x656ab)
 tap('write',0xff1020,0xff5fff)
 tap('read',0xff1020,0xff5fff)
 tap('write',0xfff800,0xfffa7f)
 tap('read',0x2c564,0x2c5e3)
 tap('read',0x1b90c,0x1b987)
end
tap('write',0xc00000,0xc00007)
event('collection_start',',"sampling":"all installed taps and selected breakpoints","coverage":"after script installation only"')

if mode=='author' then observing=true;sp:write_u8(0xff0000,1);observing=false end
local prepared=false
local start_field=nil
local start_held=false
if mode~='author' then
 for _,port in pairs(mach.ioport.ports) do
  for name,field in pairs(port.fields) do
   if name=='P1 Start' then start_field=field end
  end
 end
 assert(start_field,'P1 Start field not found')
end
sub=emu.add_machine_frame_notifier(function()
 local prior_context=clock_context
 clock_context='machine-frame-notifier'
 frames=frames+1
 if mode~='author' then
  if frames==500 then start_field:set_value(1);event('input_transition',',"button":"P1 Start","active":true') end
  if frames==510 then start_field:set_value(0);event('input_transition',',"button":"P1 Start","active":false') end
  if frames==1110 then
   capture_active=true
   cpu.debug:bpenable(break_ids[0xd762])
   observing=true;sp:write_u8(0xfff600,0x10);observing=false
   event('prepared_state',',"address":16774656,"value":16,"origin":"operator-declared assisted episode"')
  end
  if frames==1170 or frames==1290 then
   observing=true
   event('state_sample',string.format(',"gamemode":%d',sp:read_u8(0xfff600)))
   observing=false
   capture_screens()
  end
  if frames==tonumber(os.getenv('REX_MAX_FRAMES') or '1290') then
   event('collection_end',string.format(',"dropped":%d,"complete":%s,"sentinel":false',dropped,dropped==0 and 'true' or 'false'))
   out:flush();out:close();mach:exit()
  end
 end
 clock_context=prior_context
end)
while true do
 if dbg.execution_state=='stop' then
  local pc=reg('CURPC')
  local label=breaks[pc]
  if label and capture_active then
   clock_context='cpu-debugger-stop'
   observing=true
   local a7=reg('A7')
   local ret=sp:read_u32(a7)
   observing=false
   event(label,string.format(',"pc":%d,"a0":%d,"a1":%d,"a7":%d,"d0":%d,"d1":%d,"d2":%d,"sr":%d,"stack_top_long":%d',pc,reg('A0'),reg('A1'),a7,reg('D0'),reg('D1'),reg('D2'),reg('SR'),ret))
   if label=='sprite_loop_head' then
    event('sprite_arguments',string.format(',"a0":%d,"a1":%d,"a2":%d,"a3":%d,"a4":%d,"a5":%d,"d1":%d,"d2":%d,"d3":%d,"d5":%d',reg('A0'),reg('A1'),reg('A2'),reg('A3'),reg('A4'),reg('A5'),reg('D1'),reg('D2'),reg('D3'),reg('D5')))
    sprite_hits=sprite_hits+1
    if sprite_hits==20 then cpu.debug:bpdisable(break_ids[pc]);event('sampling_limit',',"scope":"sprite_loop_head_arguments","first_hits":20,"coverage":"later hits intentionally not captured"') end
   end
   if label=='return' then snapshot(reg('A1')-4,4,'destination_snapshot') end
   if label=='enigma_return' then snapshot(0xff4000,4096,'decompressed_snapshot') end
   if label=='copy_return' then snapshot(0xff1020,8128,'copy_snapshot') end
  else event('other_stop',string.format(',"pc":%d',pc)) end
  cpu.debug:go()
  clock_context='ui-debugger-coroutine'
 end
 observing=true
 local done=mode=='author' and sp:read_u32(0xff0100)==0xdeadbeef
 observing=false
 if done then capture_screens() end
 if done or (mode=='author' and frames>=tonumber(os.getenv('REX_MAX_FRAMES') or '1290')) then
  event('collection_end',string.format(',"dropped":%d,"complete":%s,"sentinel":%s',dropped,dropped==0 and 'true' or 'false',done and 'true' or 'false'))
  out:flush();out:close();mach:exit();return
 end
 emu.wait_next_update()
end
