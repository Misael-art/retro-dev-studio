//! `rex-cfg/v2` — CFG parcial por analise de fluxo delimitada (frente C, Experimental).
//!
//! Ver `docs/rex_profiles/parallel_recovery_20261004/c/CONTRACT.md`. Nada aqui
//! promove grau de evidencia, resolve chamada indireta por aparencia ou inventa
//! comprimento de opcode.

pub mod decode;
pub mod export;
pub mod grafo;
pub mod medir;
pub mod sitio;

pub use decode::{decode_at, Outcome};
