/* One-way top contact for the existing path/physics owners. No allocation or second clock.
 * Positions are sampled before physics and after path movement in the same frame.
 * Wide intermediates keep relative contact/ordering exact at s16 world boundaries.
 * Cost must be measured on the target before promoting moving-platform performance. */
typedef signed long long RdsPathWide;
typedef struct {
    s16 x, y;
    s32 time_n, time_d;
} RdsPathContact;

static u8 rds_path_top_contact(s16 x0, s16 y0, s16 x1, s16 y1, u16 bw, u16 bh,
                             s16 vy, s16 left0, s16 top0, s16 left1, s16 top1,
                             u16 width, u8 supported, RdsPathContact *out) {
    s32 gap = (s32)top0 - ((s32)y0 + bh);
    s32 dy = (s32)top1 - top0;
    s32 dx = (s32)left1 - left0;
    s32 own_x = (s32)x1 - x0;
    s32 own_y = (s32)y1 - y0;
    s32 n, d, result_x, result_y;
    RdsPathWide center, left;
    if (vy < 0 || gap < 0 || width == 0 || bw == 0 || bh == 0) return 0;
    if (supported && gap == 0 && (s32)x1 + bw / 2 >= left0 &&
        (s32)x1 + bw / 2 < (s32)left0 + width) {
        n = 0; d = 1; /* retain attachment even when a descending surface outruns gravity */
        result_x = x1 + dx; /* ordinary carrying needs no wide multiply/divide */
    } else {
        d = own_y - dy;
        n = gap;
        if (n == 0 && d == 0) d = 1;
        if (d <= 0 || n > d) return 0;
        center = ((RdsPathWide)x0 + bw / 2) * d + (RdsPathWide)own_x * n;
        left = (RdsPathWide)left0 * d + (RdsPathWide)dx * n;
        if (center < left || center >= left + (RdsPathWide)width * d) return 0;
        result_x = x1 + (s32)((RdsPathWide)dx * (d - n) / d);
    }
    result_y = (s32)top1 - bh;
    /* Walking/jumping off does not keep an invisible attachment beyond an edge. */
    if (result_x + bw / 2 < left1 || result_x + bw / 2 >= (s32)left1 + width) return 0;
    if (result_x < -32768L || result_x > 32767L || result_y < -32768L || result_y > 32767L) return 0;
    out->x = (s16)result_x; out->y = (s16)result_y;
    out->time_n = n; out->time_d = d;
    return 1;
}

static u8 rds_path_contact_before(const RdsPathContact *a, const RdsPathContact *b) {
    return (RdsPathWide)a->time_n * b->time_d < (RdsPathWide)b->time_n * a->time_d;
}
