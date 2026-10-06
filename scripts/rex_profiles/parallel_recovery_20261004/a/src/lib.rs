//! `rex-chain` — revalidación de cadeas Kosinski ROM → carga → chamada →
//! rutina → fluxo → saída, frente paralela A da recuperación 2026-10-04.
//!
//! A ferramenta **non descobre por si soa nunha cadea afirmada**: un enderezo
//! declarado convértese en medible (`construir-cadea`) e unha cadea escrita
//! convértese en reprobable contra bytes actuais (`revalidar`). `detectar`
//! aplica a gramática conxelada de extremo a extremo e marca todo como
//! detección automática — nunca promove un resultado a evidencia que non é.
//!
//! Territorio: contratos e medicións propias; os crates `rex-kosinski`
//! (decodificador) e `rex-addressing` (mapper md-linear) consómense como
//! consumidor externo, sen modificalos.

pub mod chain;
pub mod instr;
pub mod json;
pub mod verify;

pub use chain::Cadea;
pub use instr::{decodificar, Forma, InstrErro};
pub use verify::{revalidar, Elo, Estado, Resultado};
