//! Instance-owned animation timing and alignment for authored SGDK sprites.
//! SGDK still advances the frames, performs visibility checks and uploads tiles.
use std::fmt::Write;

use super::ast_generator::{AstNode, AstOutput, AuthoredPoseAnimation};
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
    out.push_str(
        "\n/* Tabelas das poses autorais por instância. */\n\
         typedef struct { const u8 *ticks; s16 dx, dy; } RdsPoseFrame;\n\
         typedef struct { u16 count; const RdsPoseFrame *frames; } RdsPoseAnimation;\n",
    );
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
            }
            writeln!(out, "static const RdsPoseFrame {sequence}[] = {{").unwrap();
            for (index, frame) in animation.frames.iter().enumerate() {
                writeln!(
                    out,
                    "    {{ &{sequence}_f{index}_ticks, {}, {} }},",
                    frame.offset.0, frame.offset.1
                )
                .unwrap();
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
                out.push_str("    { 0, NULL },\n");
            } else {
                writeln!(out, "    {{ {count}, {name}_a{i} }},").unwrap();
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
        writeln!(out,
            "static void {name}_change(Sprite *sprite) {{\n\
             \x20   const RdsPoseFrame *frame = {name}_current(sprite);\n\
             \x20   if (frame && SPR_getAutoAnimation(sprite)) sprite->timer = *frame->ticks;\n{position_call}}}").unwrap();
    }
    out.push('\n');
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
