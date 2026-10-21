-- Author-only CPU IRQ6/DMA presentation-phase calibration.
local mach=manager.machine
local cpu=mach.devices[':maincpu']
local sp=cpu.spaces.program
local outpath=assert(os.getenv('REX_EVENTS'))
assert(io.open(outpath,'rb')==nil,'refuse overwrite')
local out=assert(io.open(outpath,'wb'))
local run=assert(os.getenv('REX_RUN_ID'))
local rom=assert(os.getenv('REX_ROM_SHA'))
local inst=assert(os.getenv('REX_INSTRUMENT_SHA'))
local seq,frame,dropped=0,0,0
local observing,finished=false,false
local taps={}
local vram,cram
local screen
for _,dev in pairs(mach.devices) do
 if dev.shortname=='sega315_5313' then
  for name,index in pairs(dev.items) do
   if name:match('m_vram$') then vram=emu.item(index) end
   if name:match('m_cram$') then cram=emu.item(index) end
  end
 end
end
for _,s in pairs(mach.screens) do assert(screen==nil,'one screen required');screen=s end
assert(vram and vram.size==2 and vram.count==32768)
assert(cram and cram.size==2 and cram.count==64)
local function event(kind,fields,space)
 if seq>=20000 and kind~='collection_end' then dropped=dropped+1;return end
 seq=seq+1
 out:write(string.format('{"run_id":"%s","rom_sha256":"%s","instrument_sha256":"%s","runtime":"MAME","seq":%d,"frame":%d,"emulated_time":"%s","temporal_domain":"machine-attotime","address_space":"%s","kind":"%s"%s}\n',run,rom,inst,seq,frame,tostring(mach.time),space or 'md.cpu.bus24',kind,fields or ''))
 out:flush()
end
local function tap(kind,first,last)
 local fn=function(addr,data,mask)
  if observing or mach:side_effects_disabled() then return end
  event(kind,string.format(',"address":%d,"data":%d,"mask":%d,"instruction_pc":%d',addr,data,mask,cpu.state.CURPC.value))
 end
 if kind=='read' then taps[#taps+1]=sp:install_read_tap(first,last,'phase_source',fn)
 else taps[#taps+1]=sp:install_write_tap(first,last,'phase_'..first,fn) end
end
tap('read',0xfff800,0xfff807)
tap('write',0xfff800,0xfff807)
tap('write',0xc00004,0xc00007)
event('collection_start',',"origin":"author program IRQ6 updates X and DMA; no operator video writes"')
local notifier=emu.add_machine_frame_notifier(function()
 if finished then return end
 frame=frame+1
 observing=true
 local counter=sp:read_u16(0xff0400)
 local source=sp:read_u16(0xfff806)
 observing=false
 local sat={}
 for i=0,3 do sat[#sat+1]=string.format('%04x',vram:read(0xf800//2+i)) end
 local stem=os.getenv('REX_SNAP_DIR')..'/frame-'..frame
 local err=screen:snapshot(stem..'.png')
 assert(err==nil,err)
 local pixels=mach.video:snapshot_pixels()
 local width,height=mach.video:snapshot_size()
 local f=assert(io.open(stem..'.snapshot.pixels','wb'));f:write(pixels);f:close()
 event('frame_capture',string.format(',"counter":%d,"source_x_word":%d,"native_sat_hex":"%s","cram1":%d,"width":%d,"height":%d,"png":"%s"',counter,source,table.concat(sat),cram:read(1),width,height,stem..'.png'),'md.vdp.native-and-presented-target')
 if frame==20 then
  event('collection_end',string.format(',"complete":%s,"dropped":%d',dropped==0 and 'true' or 'false',dropped))
  finished=true;out:close();mach:exit()
 end
end)
observing=true;sp:write_u8(0xff0000,1);observing=false
while not finished do
 if mach.debugger.execution_state=='stop' then cpu.debug:go() end
 emu.wait_next_update()
end
