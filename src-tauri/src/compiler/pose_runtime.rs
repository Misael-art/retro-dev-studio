//! Instance-owned animation timing and alignment for authored SGDK sprites.
//! SGDK still advances the frames, performs visibility checks and uploads tiles.
use std::fmt::Write;

use super::ast_generator::{collect_sfx_resources, AstNode, AstOutput, AuthoredPoseAnimation};
use super::build_provenance::hex_encode;

pub(super) fn duration_marker(entity: &str, animation: &str, occurrence: &str) -> String {
    format!(
        "// RDS_POSE_DURATION {} {} {}",
        hex_encode(entity.as_bytes()),
        hex_encode(animation.as_bytes()),
        hex_encode(occurrence.as_bytes())
    )
}

pub(super) fn distinct_actors(
    ast: &AstOutput,
) -> impl Iterator<Item = (&str, &str, &[AuthoredPoseAnimation])> {
    ast.nodes.iter().filter_map(|node| match node {
        AstNode::AuthoredPosePlayback {
            entity_id,
            var_name,
            animations: Ok(animations),
        } if animations
            .iter()
            .any(|animation| !animation.frames.is_empty()) =>
        {
            Some((entity_id.as_str(), var_name.as_str(), animations.as_slice()))
        }
        _ => None,
    })
}

fn aligned(animations: &[AuthoredPoseAnimation]) -> bool {
    animations
        .iter()
        .any(|animation| animation.frames.iter().any(|frame| frame.offset != (0, 0)))
}

fn has_events(animations: &[AuthoredPoseAnimation]) -> bool {
    animations
        .iter()
        .any(|animation| !animation.events.is_empty())
}

fn has_boxes(animations: &[AuthoredPoseAnimation]) -> bool {
    animations.iter().any(|animation| {
        animation
            .frames
            .iter()
            .any(|frame| !frame.attack_boxes.is_empty() || !frame.body_boxes.is_empty())
    })
}

pub(super) fn actor_has_boxes(ast: &AstOutput, sprite: &str) -> bool {
    distinct_actors(ast).any(|(_, var, animations)| var == sprite && has_boxes(animations))
}

pub(super) fn needs_screen_position(ast: &AstOutput) -> bool {
    distinct_actors(ast).any(|(_, _, animations)| aligned(animations))
}

pub(super) fn emit_declarations(out: &mut String, ast: &AstOutput) {
    for node in &ast.nodes {
        if let AstNode::AuthoredPosePlayback {
            entity_id,
            animations: Err(message),
            ..
        } = node
        {
            let clean = |value: &str| value.replace(['"', '\r', '\n', '\\'], " ");
            writeln!(
                out,
                "#error \"Pose de '{}': {}\"",
                clean(entity_id),
                clean(message)
            )
            .unwrap();
        }
    }
    if distinct_actors(ast).next().is_none() {
        return;
    }
    let any_boxes = distinct_actors(ast).any(|(_, _, animations)| has_boxes(animations));
    out.push_str("\n/* Tabelas das poses autorais por instância. */\n");
    if any_boxes {
        out.push_str("typedef struct { s16 x1, y1, x2, y2; } RdsPoseBox;\n");
    }
    out.push_str("typedef struct { const u8 *ticks; s16 dx, dy;");
    if any_boxes {
        out.push_str(" const RdsPoseBox *attack, *body; u8 attacks, bodies;");
    }
    out.push_str(" } RdsPoseFrame;\ntypedef struct { u16 count; const RdsPoseFrame *frames; bool looping; } RdsPoseAnimation;\n");
    let sounds = collect_sfx_resources(ast);
    for (entity, sprite, animations) in distinct_actors(ast) {
        let name = format!("rds_pose_{sprite}");
        for (animation_index, animation) in animations.iter().enumerate() {
            let sequence = format!("{name}_a{animation_index}");
            if animation.frames.is_empty() {
                continue;
            }
            for (index, frame) in animation.frames.iter().enumerate() {
                writeln!(
                    out,
                    "{}",
                    duration_marker(entity, &animation.name, &frame.occurrence_id)
                )
                .unwrap();
                writeln!(
                    out,
                    "static const u8 {sequence}_f{index}_ticks = {};",
                    frame.ticks
                )
                .unwrap();
                for (kind, boxes) in [("attack", &frame.attack_boxes), ("body", &frame.body_boxes)]
                {
                    if boxes.is_empty() {
                        continue;
                    }
                    writeln!(
                        out,
                        "static const RdsPoseBox {sequence}_f{index}_{kind}[] = {{"
                    )
                    .unwrap();
                    for [x1, y1, x2, y2] in boxes {
                        writeln!(out, "    {{ {x1}, {y1}, {x2}, {y2} }},").unwrap();
                    }
                    out.push_str("};\n");
                }
            }
            writeln!(out, "static const RdsPoseFrame {sequence}[] = {{").unwrap();
            for (index, frame) in animation.frames.iter().enumerate() {
                write!(
                    out,
                    "    {{ &{sequence}_f{index}_ticks, {}, {}",
                    frame.offset.0, frame.offset.1
                )
                .unwrap();
                if any_boxes {
                    for (kind, boxes) in
                        [("attack", &frame.attack_boxes), ("body", &frame.body_boxes)]
                    {
                        if boxes.is_empty() {
                            out.push_str(", NULL");
                        } else {
                            write!(out, ", {sequence}_f{index}_{kind}").unwrap();
                        }
                    }
                    write!(
                        out,
                        ", {}, {}",
                        frame.attack_boxes.len(),
                        frame.body_boxes.len()
                    )
                    .unwrap();
                }
                out.push_str(" },\n");
            }
            out.push_str("};\n");
        }
        writeln!(
            out,
            "static const RdsPoseAnimation {name}_animations[] = {{"
        )
        .unwrap();
        for (i, animation) in animations.iter().enumerate() {
            let count = animation.frames.len();
            if count == 0 {
                out.push_str("    { 0, NULL, FALSE },\n");
            } else {
                let looping = if animation.looping { "TRUE" } else { "FALSE" };
                writeln!(out, "    {{ {count}, {name}_a{i}, {looping} }},").unwrap();
            }
        }
        out.push_str("};\n");
        writeln!(
            out,
            "static const RdsPoseFrame *{name}_current(Sprite *sprite) {{\n\
             \x20   if (!sprite || sprite->animInd < 0 || sprite->animInd >= {}) return NULL;\n\
             \x20   const RdsPoseAnimation *anim = &{name}_animations[sprite->animInd];\n\
             \x20   if (sprite->frameInd < 0 || sprite->frameInd >= anim->count) return NULL;\n\
             \x20   return &anim->frames[sprite->frameInd];\n}}",
            animations.len()
        )
        .unwrap();
        let position_call = if aligned(animations) {
            writeln!(out,
                "static void {name}_place(Sprite *sprite, const RdsPoseFrame *frame) {{\n\
                 \x20   if (!sprite) return;\n\
                 \x20   s16 dx = frame ? frame->dx : 0, dy = frame ? frame->dy : 0;\n\
                 \x20   if (sprite->attribut & TILE_ATTR_HFLIP_MASK) dx = -dx;\n\
                 \x20   if (sprite->attribut & TILE_ATTR_VFLIP_MASK) dy = -dy;\n\
                 \x20   rds_pose_screen_position(sprite, {sprite}_x - RDS_CAMERA_SCREEN_X + dx, {sprite}_y - RDS_CAMERA_SCREEN_Y + dy);\n}}").unwrap();
            format!("    {name}_place(sprite, frame);\n")
        } else {
            String::new()
        };
        let visible_frame = has_boxes(animations) || has_events(animations);
        if visible_frame {
            writeln!(out, "static const RdsPoseFrame *{name}_visible_frame;").unwrap();
        }
        let on_event_frame = if has_events(animations) {
            emit_event_handler(out, &name, animations, &sounds);
            format!("    {name}_elapsed = 0;\n")
        } else {
            String::new()
        };
        let on_box_frame = if has_boxes(animations) {
            emit_box_view(out, &name, sprite, animations[0].cell);
            format!("    if (frame && (sprite->frameInd == 0 || {name}_box_animation != sprite->animInd)) {{\n        {name}_box_cycle++;\n        {name}_box_animation = sprite->animInd;\n    }}\n")
        } else {
            String::new()
        };
        let on_visible_frame = if visible_frame {
            format!("    {name}_visible_frame = frame;\n")
        } else {
            String::new()
        };
        writeln!(
            out,
            "static void {name}_change(Sprite *sprite) {{\n\
             \x20   const RdsPoseFrame *frame = {name}_current(sprite);\n\
             \x20   if (frame) {{\n\
             \x20       SPR_setAnimationLoop(sprite, {name}_animations[sprite->animInd].looping);\n\
             \x20       if (SPR_getAutoAnimation(sprite)) sprite->timer = *frame->ticks;\n\
             \x20   }}\n{position_call}{on_event_frame}{on_box_frame}{on_visible_frame}}}"
        )
        .unwrap();
    }
    out.push('\n');
}

fn emit_event_handler(
    out: &mut String,
    name: &str,
    animations: &[AuthoredPoseAnimation],
    sounds: &[(String, String)],
) {
    writeln!(
        out,
        "static u16 {name}_elapsed;\n\
         static void {name}_dispatch(Sprite *sprite) {{\n\
         \x20   const RdsPoseFrame *frame = {name}_current(sprite);\n\
         \x20   if (!frame || frame != {name}_visible_frame) return;\n\
         \x20   if ({name}_elapsed && !SPR_getAutoAnimation(sprite)) return;\n\
         \x20   const RdsPoseAnimation *anim = &{name}_animations[sprite->animInd];\n\
         \x20   if ({name}_elapsed >= *frame->ticks) {{\n\
         \x20       if (anim->count != 1 || !anim->looping || !*frame->ticks) return;\n\
         \x20       {name}_elapsed = 0;\n\
         \x20   }}\n\
         \x20   const u16 tick = {name}_elapsed++;\n\
         \x20   switch (sprite->animInd) {{"
    )
    .unwrap();
    for (index, animation) in animations
        .iter()
        .enumerate()
        .filter(|(_, a)| !a.events.is_empty())
    {
        writeln!(out, "        case {index}:").unwrap();
        for event in &animation.events {
            if !sounds.iter().any(|(action, _)| action == &event.sound) {
                let action = event.sound.replace(['"', '\\', '\r', '\n'], " ");
                writeln!(
                    out,
                    "#error \"Som '{}' ausente no projeto para a pose\"",
                    action
                )
                .unwrap();
                continue;
            }
            writeln!(
                out,
                "            if (sprite->frameInd == {} && tick == {}) XGM_startPlayPCM(SFX_{}, 1, SOUND_PCM_CH2);",
                event.frame, event.tick, event.sound.to_uppercase()
            )
            .unwrap();
        }
        out.push_str("            break;\n");
    }
    out.push_str("    }\n}\n");
}

fn emit_box_view(out: &mut String, name: &str, sprite: &str, (width, height): (u32, u32)) {
    writeln!(out,
        "static u16 {name}_box_cycle;\n\
         static s16 {name}_box_animation = -1;\n\
         static inline RdsPoseBox {name}_world_box(const RdsPoseFrame *frame, const RdsPoseBox *box) {{\n\
         \x20   const bool flip_x = ({sprite}->attribut & TILE_ATTR_HFLIP_MASK) != 0;\n\
         \x20   const bool flip_y = ({sprite}->attribut & TILE_ATTR_VFLIP_MASK) != 0;\n\
         \x20   const s16 x = {sprite}_x + (flip_x ? -frame->dx : frame->dx);\n\
         \x20   const s16 y = {sprite}_y + (flip_y ? -frame->dy : frame->dy);\n\
         \x20   return (RdsPoseBox) {{\n\
         \x20       x + (flip_x ? {width} - box->x2 : box->x1), y + (flip_y ? {height} - box->y2 : box->y1),\n\
         \x20       x + (flip_x ? {width} - box->x1 : box->x2), y + (flip_y ? {height} - box->y1 : box->y2)\n\
         \x20   }};\n}}"
    ).unwrap();
}

pub(super) fn emit_events(out: &mut String, ast: &AstOutput, indent: usize) {
    for (_, sprite, _) in distinct_actors(ast).filter(|(_, _, animations)| has_events(animations)) {
        writeln!(out, "{:indent$}rds_pose_{sprite}_dispatch({sprite});", "").unwrap();
    }
}

pub(super) fn emit_positions(out: &mut String, ast: &AstOutput) {
    for (_, sprite, _) in distinct_actors(ast).filter(|(_, _, animations)| aligned(animations)) {
        let name = format!("rds_pose_{sprite}");
        writeln!(
            out,
            "        {name}_place({sprite}, {name}_current({sprite}));"
        )
        .unwrap();
    }
}
