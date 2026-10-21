#include <genesis.h>
#include "assets.h"
// Presentation infrastructure authored for this test. It is not recovered code.
struct Scope { u8 guard0[16], source[64], guard1[16], destination[128], guard2[16]; u16 map[112]; u8 guard3[16]; u32 done; };
volatile struct Scope visual_scope;
extern void visual_copy(void);
int main(bool hard) {
    u16 i, x, y;
    (void)hard;
    SYS_disableInts();
    VDP_setScreenWidth320(); VDP_setScreenHeight224();
    VDP_setPlaneSize(64,32,TRUE);
    VDP_clearPlane(BG_A,TRUE); VDP_clearPlane(BG_B,TRUE);
    for(i=0;i<16;i++) { visual_scope.guard0[i]=0xa5; visual_scope.guard1[i]=0x5a; visual_scope.guard2[i]=0xc3; visual_scope.guard3[i]=0x3c; }
    for(i=0;i<64;i++) visual_scope.source[i]=visual_resource[i];
    for(i=0;i<128;i++) visual_scope.destination[i]=0;
    visual_copy();
    for(i=0;i<112;i++) {
        u8 v=visual_scope.destination[i];
        if(v>15) while(TRUE) {} // both declared widths must stay in-domain
        visual_scope.map[i]=TILE_ATTR_FULL(v>>3,FALSE,FALSE,FALSE,TILE_USER_INDEX+(v&7));
    }
    PAL_setPalette(PAL0,visual_palette0,CPU); PAL_setPalette(PAL1,visual_palette1,CPU); PAL_setPalette(PAL2,visual_palette2,CPU);
    VDP_loadTileData(visual_tiles,TILE_USER_INDEX,10,CPU);
    for(y=0;y<28;y++) for(x=0;x<40;x++) VDP_setTileMapXY(BG_B,TILE_ATTR_FULL(PAL2,FALSE,FALSE,FALSE,TILE_USER_INDEX+8+((x+y)&1)),x,y);
    VDP_setTileMapDataRect(BG_A,(const u16 *)visual_scope.map,5,5,16,7,16,CPU);
    SYS_enableInts();
    SYS_doVBlankProcess();
    visual_scope.done=0x56495355;
    while(TRUE) SYS_doVBlankProcess();
    return 0;
}
