// Camera v1. World anchor -> screen point; one update after gameplay, no frame allocation.
typedef struct { s16 x,y,width,height,smooth; } RdsCameraRoom;
typedef struct { s16 x,y; s32 frames,wait; } RdsCameraPoint;
typedef struct { s16 *x,*y; } RdsCameraTarget;
typedef struct {
    s16 pattern,x,y,ox,oy,ax,ay,sx,sy,horizontal,vertical,response_x,response_y,dead_x,dead_y,look,max_speed,speed,paused;
    s16 min_x,min_y,max_x,max_y,backtracking,return_target,smooth;
    s16 *tx,*ty;
    u16 room_start,room_count,path_start,path_count,target_start,target_count;
    s16 has_region,region_x,region_y,region_w,region_h,priority;
    s16 ratio_x[2],ratio_y[2];
} RdsCameraConfig;
static volatile u16 rds_cam_initialized=0, rds_camera_active=RDS_VISUAL_CAMERA_INITIAL;
static volatile u16 rds_camera_paused=0, rds_camera_separated=0;
static volatile s16 rds_camera_room=-1, rds_camera_base_x=0, rds_camera_base_y=0;
static s16 rds_cam_manual=0,rds_cam_switching=0;
static s32 rds_cam_previous_x=0,rds_cam_direction=0,rds_cam_remainder=0,rds_cam_furthest=-16000;
static u16 rds_cam_path_index=0,rds_cam_path_fresh=1;
static s32 rds_cam_path_tick=0,rds_cam_path_from_x=0,rds_cam_path_from_y=0;
static s16 rds_cam_offset_x[RDS_VISUAL_CAMERA_COUNT],rds_cam_offset_y[RDS_VISUAL_CAMERA_COUNT];
static s16 rds_cam_shake_x[RDS_VISUAL_CAMERA_COUNT],rds_cam_shake_y[RDS_VISUAL_CAMERA_COUNT];
static u16 rds_cam_offset_left[RDS_VISUAL_CAMERA_COUNT],rds_cam_shake_left[RDS_VISUAL_CAMERA_COUNT];

/* RDS_CAMERA_DATA */

static s32 rds_cam_clamp(s32 n,s32 lo,s32 hi){return n<lo?lo:(n>hi?hi:n);}
static s32 rds_cam_approach(s32 from,s32 to,s32 dead,s32 response,s32 speed){
    s32 diff=to-from,distance=diff<0?-diff:diff,step;
    distance-=dead;if(distance<=0)return from;step=distance/response;if(step<1)step=1;if(step>speed)step=speed;
    return from+(diff<0?-step:step);
}
static u16 rds_cam_target(const RdsCameraConfig *c,s32 *tx,s32 *ty,u16 *separated){
    s32 minx,maxx,miny,maxy,px,py;u16 i;
    *tx=c->tx?*c->tx:0;*ty=c->ty?*c->ty:0;*separated=0;
    if(c->pattern!=7){return c->tx&&c->ty;}
    if(!c->target_count){return 0;}
    minx=maxx=*rds_cam_targets[c->target_start].x;miny=maxy=*rds_cam_targets[c->target_start].y;
    for(i=1;i<c->target_count;i++){
        px=*rds_cam_targets[c->target_start+i].x;py=*rds_cam_targets[c->target_start+i].y;
        if(px<minx){minx=px;}if(px>maxx){maxx=px;}if(py<miny){miny=py;}if(py>maxy){maxy=py;}
    }
    *tx=(minx+maxx)/2;*ty=(miny+maxy)/2;*separated=(maxx-minx>RDS_VISUAL_CAMERA_WIDTH||maxy-miny>224);
    return 1;
}
static void rds_cam_reset(u16 index,u16 smooth){
    const RdsCameraConfig *c=&rds_cam_configs[index];
    s32 tx,ty;u16 separated;
    rds_cam_initialized=(smooth&&rds_cam_initialized)?1:0;rds_cam_switching=rds_cam_initialized;
    rds_camera_active=index;rds_camera_room=-1;rds_cam_direction=0;rds_cam_remainder=0;rds_cam_furthest=-16000;
    rds_cam_target(c,&tx,&ty,&separated);rds_cam_previous_x=tx;rds_cam_path_index=0;rds_cam_path_tick=0;rds_cam_path_fresh=1;
    rds_cam_path_from_x=rds_cam_initialized?rds_camera_base_x:(s32)c->x+c->ox;
    rds_cam_path_from_y=rds_cam_initialized?rds_camera_base_y:(s32)c->y+c->oy;
}
/* Actions: select, regions, pause, resume, shake, offset, restart. Durations count game frames. */
static void rds_visual_camera_control(s16 index,s16 action,u16 frames,s16 x,s16 y){
    if(index<0||index>=RDS_VISUAL_CAMERA_COUNT)return;
    switch(action){
    case 0:rds_cam_manual=1;if(index!=rds_camera_active)rds_cam_reset(index,rds_cam_configs[index].smooth);break;
    case 1:rds_cam_manual=0;break;
    case 2:rds_cam_pauses[index]=1;break;
    case 3:rds_cam_pauses[index]=0;break;
    case 4:rds_cam_shake_x[index]=x<0?-x:x;rds_cam_shake_y[index]=y<0?-y:y;rds_cam_shake_left[index]=frames;break;
    case 5:rds_cam_offset_x[index]=x;rds_cam_offset_y[index]=y;rds_cam_offset_left[index]=frames;break;
    case 6:if(index==rds_camera_active)rds_cam_reset(index,0);rds_cam_pauses[index]=rds_cam_configs[index].paused;rds_cam_offset_left[index]=0;rds_cam_shake_left[index]=0;break;
    }
}
/* One non-reentrant update after gameplay. Static scratch and small helpers keep
   816-tcc's stack-relative temporaries within the 65816's 8-bit address range. */
static const RdsCameraConfig *rds_cam_current;
static const RdsCameraPoint *rds_cam_point;
static s32 rds_cam_tx,rds_cam_ty,rds_cam_cx,rds_cam_cy,rds_cam_dx,rds_cam_dy,rds_cam_px,rds_cam_py;
static s16 rds_cam_cut;

static u16 rds_cam_contains(s32 x,s32 y,s32 left,s32 top,s32 width,s32 height){
    return x>=left&&x<left+width&&y>=top&&y<top+height;
}
static void rds_cam_regions(void){
    s16 best=-1,priority=-16001;u16 i,separated;s32 tx,ty;
    const RdsCameraConfig *c;
    if(rds_cam_manual)return;
    for(i=0;i<RDS_VISUAL_CAMERA_COUNT;i++){
        c=&rds_cam_configs[i];
        if(!c->has_region||!rds_cam_target(c,&tx,&ty,&separated))continue;
        if(rds_cam_contains(tx+c->ax,ty+c->ay,c->region_x,c->region_y,c->region_w,c->region_h)&&c->priority>priority){best=i;priority=c->priority;}
    }
    if(best>=0&&best!=rds_camera_active)rds_cam_reset(best,rds_cam_configs[best].smooth);
}
static void rds_cam_desired(void){
    const RdsCameraConfig *c=rds_cam_current;
    rds_cam_dx=rds_cam_tx+c->ax-c->sx+c->ox+c->look*rds_cam_direction;
    rds_cam_dy=rds_cam_ty+c->ay-c->sy+c->oy;
}
static void rds_cam_room(void){
    const RdsCameraConfig *c=rds_cam_current;const RdsCameraRoom *r;
    s16 room=-1;u16 i;
    for(i=0;i<c->room_count;i++){
        r=&rds_cam_rooms[c->room_start+i];
        if(rds_cam_contains(rds_cam_tx+c->ax,rds_cam_ty+c->ay,r->x,r->y,r->width,r->height)){room=c->room_start+i;break;}
    }
    if(room<0)room=rds_camera_room;
    if(room<0)return;
    r=&rds_cam_rooms[room];
    if(room!=rds_camera_room&&!r->smooth&&!rds_cam_switching)rds_cam_cut=1;
    if(room!=rds_camera_room)rds_cam_switching=0;
    rds_camera_room=room;
    rds_cam_dx=rds_cam_clamp(rds_cam_dx,r->x,(s32)r->x+(r->width>RDS_VISUAL_CAMERA_WIDTH?r->width-RDS_VISUAL_CAMERA_WIDTH:0));
    rds_cam_dy=rds_cam_clamp(rds_cam_dy,r->y,(s32)r->y+(r->height>224?r->height-224:0));
}
static void rds_cam_follow_x(void){
    const RdsCameraConfig *c=rds_cam_current;
    if(c->horizontal)rds_cam_cx=rds_cam_cut?rds_cam_dx:rds_cam_approach(rds_cam_cx,rds_cam_dx,c->dead_x,c->response_x,c->max_speed);
    if(c->pattern==6&&!c->backtracking&&rds_cam_cx<rds_cam_furthest)rds_cam_cx=rds_cam_furthest;
}
static void rds_cam_follow_y(void){
    const RdsCameraConfig *c=rds_cam_current;
    if(c->vertical)rds_cam_cy=rds_cam_cut?rds_cam_dy:rds_cam_approach(rds_cam_cy,rds_cam_dy,c->dead_y,c->response_y,c->max_speed);
}
static void rds_cam_follow(void){
    if(rds_cam_initialized&&rds_cam_tx!=rds_cam_previous_x)rds_cam_direction=rds_cam_tx>rds_cam_previous_x?1:-1;
    rds_cam_desired();rds_cam_cut=!rds_cam_initialized;
    if(rds_cam_current->pattern==5)rds_cam_room();
    rds_cam_follow_x();rds_cam_follow_y();
}
static void rds_cam_fixed(void){
    const RdsCameraConfig *c=rds_cam_current;
    rds_cam_dx=(s32)c->x+c->ox;rds_cam_dy=(s32)c->y+c->oy;
    rds_cam_cx=rds_cam_switching?rds_cam_approach(rds_cam_cx,rds_cam_dx,0,c->response_x,c->max_speed):rds_cam_dx;
    rds_cam_cy=rds_cam_switching?rds_cam_approach(rds_cam_cy,rds_cam_dy,0,c->response_y,c->max_speed):rds_cam_dy;
    if(rds_cam_cx==rds_cam_dx&&rds_cam_cy==rds_cam_dy)rds_cam_switching=0;
}
static s32 rds_cam_lerp(s32 from,s32 to,s32 frames,s32 tick){
    if(!frames)return to;
    if(tick>frames)tick=frames;
    return from+(to-from)*tick/frames;
}
static void rds_cam_path_move(void){
    const RdsCameraConfig *c=rds_cam_current;const RdsCameraPoint *p=rds_cam_point;
    rds_cam_px=(s32)p->x+c->ox;rds_cam_py=(s32)p->y+c->oy;
    if(c->horizontal)rds_cam_cx=rds_cam_lerp(rds_cam_path_from_x,rds_cam_px,p->frames,rds_cam_path_tick);
    if(c->vertical)rds_cam_cy=rds_cam_lerp(rds_cam_path_from_y,rds_cam_py,p->frames,rds_cam_path_tick);
}
static void rds_cam_path_advance(void){
    const RdsCameraConfig *c=rds_cam_current;const RdsCameraPoint *p=rds_cam_point;
    if(rds_cam_path_tick<p->frames+p->wait)return;
    rds_cam_path_index++;rds_cam_path_tick=0;rds_cam_path_from_x=rds_cam_px;rds_cam_path_from_y=rds_cam_py;
    rds_cam_path_fresh=(rds_cam_path_index<c->path_count&&rds_cam_points[c->path_start+rds_cam_path_index].frames==0);
}
static u16 rds_cam_path_step(void){
    const RdsCameraConfig *c=rds_cam_current;
    if(c->pattern!=8||rds_cam_path_index>=c->path_count)return 0;
    if(!rds_camera_paused){
        rds_cam_point=&rds_cam_points[c->path_start+rds_cam_path_index];
        if(rds_cam_initialized&&!rds_cam_path_fresh)rds_cam_path_tick++;
        rds_cam_path_fresh=0;rds_cam_path_move();rds_cam_path_advance();
    }
    return 1;
}
static void rds_cam_auto(void){
    const RdsCameraConfig *c=rds_cam_current;s32 step;
    if(!rds_cam_initialized)return;
    rds_cam_remainder+=c->speed;step=rds_cam_remainder/RDS_VISUAL_CAMERA_FPS;rds_cam_remainder-=step*RDS_VISUAL_CAMERA_FPS;
    if(c->pattern==3&&c->horizontal)rds_cam_cx+=step;
    if(c->pattern==4&&c->vertical)rds_cam_cy+=step;
}
static void rds_cam_base(void){
    const RdsCameraConfig *c=rds_cam_current;
    rds_cam_cx=rds_cam_clamp(rds_cam_cx,c->min_x,c->max_x);rds_cam_cy=rds_cam_clamp(rds_cam_cy,c->min_y,c->max_y);
    rds_camera_base_x=rds_cam_cx;rds_camera_base_y=rds_cam_cy;
    if(rds_cam_cx>rds_cam_furthest)rds_cam_furthest=rds_cam_cx;
}
static void rds_cam_effects(void){
    u16 index=rds_camera_active;s32 sign;
    if(rds_cam_offset_left[index]){rds_cam_cx+=rds_cam_offset_x[index];rds_cam_cy+=rds_cam_offset_y[index];}
    if(rds_cam_shake_left[index]){sign=(rds_cam_shake_left[index]&1)?-1:1;rds_cam_cx+=sign*rds_cam_shake_x[index];rds_cam_cy+=sign*rds_cam_shake_y[index];}
}
static void rds_cam_present(void){
    const RdsCameraConfig *c=rds_cam_current;u16 i;
    rds_camera_x=rds_cam_clamp(rds_cam_cx,c->min_x,c->max_x);rds_camera_y=rds_cam_clamp(rds_cam_cy,c->min_y,c->max_y);
    for(i=0;i<2;i++){rds_camera_ratio_x[i]=c->ratio_x[i];rds_camera_ratio_y[i]=c->ratio_y[i];}
    for(i=0;i<RDS_VISUAL_CAMERA_COUNT;i++){if(rds_cam_offset_left[i])rds_cam_offset_left[i]--;if(rds_cam_shake_left[i])rds_cam_shake_left[i]--;}
}
static u16 rds_cam_follows(void){
    s16 p=rds_cam_current->pattern;
    return p==1||p==2||p==5||p==6||p==7||(p==8&&rds_cam_current->return_target);
}
static void rds_visual_camera_tick(void){
    u16 separated,path_active;
    const RdsCameraConfig *c;
    (void)rds_visual_camera_control;
    rds_cam_regions();c=&rds_cam_configs[rds_camera_active];rds_cam_current=c;rds_camera_paused=rds_cam_pauses[rds_camera_active];
    rds_cam_target(c,&rds_cam_tx,&rds_cam_ty,&separated);rds_camera_separated=separated;
    rds_cam_cx=rds_cam_initialized?rds_camera_base_x:(s32)c->x+c->ox;
    rds_cam_cy=rds_cam_initialized?rds_camera_base_y:(s32)c->y+c->oy;
    if(!rds_cam_initialized){rds_cam_path_from_x=rds_cam_cx;rds_cam_path_from_y=rds_cam_cy;}
    path_active=rds_cam_path_step();
    if(!rds_camera_paused&&!path_active){
        if(c->pattern==0)rds_cam_fixed();
        else if(rds_cam_follows()&&(c->tx||c->pattern==7))rds_cam_follow();
        else if(c->pattern==3||c->pattern==4)rds_cam_auto();
    }
    rds_cam_base();rds_cam_effects();rds_cam_present();
    rds_cam_previous_x=rds_cam_tx;rds_cam_initialized=1;
}
