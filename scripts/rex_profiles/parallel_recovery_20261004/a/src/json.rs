//! Lector/escritor JSON plano, estrito e sen dependencias.
//!
//! O contrato `rex-kosinski-chain/v1` é un obxecto plano de escalares e
//! listas de cadenas: non hai anidamento que poida esconder un campo. Este
//! parser rexeita todo o que non coñece (obxectos internos, listas con
//! números, `\u`, claves duplicadas, texto sobrante) en vez de interpreter:
//! unha cadea de evidencia malformada debe producir `ESQUEMA`, non un valor
//! estimado.

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Valor {
    Null,
    Int(u64),
    Str(String),
    Lista(Vec<String>),
}

impl Valor {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Valor::Str(s) => Some(s),
            _ => None,
        }
    }
    pub fn as_uint(&self) -> Option<u64> {
        match self {
            Valor::Int(n) => Some(*n),
            _ => None,
        }
    }
    pub fn as_lista(&self) -> Option<&[String]> {
        match self {
            Valor::Lista(v) => Some(v),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Motivo {
    pub codigo: &'static str,
    pub detalle: String,
}

impl Motivo {
    fn novo(codigo: &'static str, detalle: impl Into<String>) -> Motivo {
        Motivo {
            codigo,
            detalle: detalle.into(),
        }
    }
}

/// Analiza un obxecto JSON plano. Devolve os campos na orde de entrada.
pub fn interpretar(texto: &str) -> Result<Vec<(String, Valor)>, Motivo> {
    let b = texto.as_bytes();
    let mut p = Parser { b, i: 0 };
    p.brancos();
    p.obxecto()
}

struct Parser<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> Parser<'a> {
    fn brancos(&mut self) {
        while self.i < self.b.len() && matches!(self.b[self.i], b' ' | b'\t' | b'\n' | b'\r') {
            self.i += 1;
        }
    }

    fn peek(&self) -> Option<u8> {
        self.b.get(self.i).copied()
    }

    fn obxecto(&mut self) -> Result<Vec<(String, Valor)>, Motivo> {
        if self.peek() != Some(b'{') {
            return Err(Motivo::novo("ESQUEMA", "o obxecto debe empezar con '{'"));
        }
        self.i += 1;
        let mut out: Vec<(String, Valor)> = Vec::new();
        self.brancos();
        if self.peek() == Some(b'}') {
            self.i += 1;
            return Ok(out);
        }
        loop {
            self.brancos();
            let clave = self.cadena()?;
            self.brancos();
            if self.peek() != Some(b':') {
                return Err(Motivo::novo(
                    "ESQUEMA",
                    format!("falta ':' tras \"{clave}\""),
                ));
            }
            self.i += 1;
            self.brancos();
            let valor = self.valor()?;
            if out.iter().any(|(k, _)| *k == clave) {
                return Err(Motivo::novo("ESQUEMA", format!("clave duplicada: {clave}")));
            }
            out.push((clave, valor));
            self.brancos();
            match self.peek() {
                Some(b',') => {
                    self.i += 1;
                }
                Some(b'}') => {
                    self.i += 1;
                    break;
                }
                other => {
                    return Err(Motivo::novo(
                        "ESQUEMA",
                        format!("separador inesperado: {:?}", other.map(char::from)),
                    ));
                }
            }
        }
        self.brancos();
        if self.i != self.b.len() {
            return Err(Motivo::novo("ESQUEMA", "texto sobrante tras o obxecto"));
        }
        Ok(out)
    }

    fn valor(&mut self) -> Result<Valor, Motivo> {
        match self.peek() {
            Some(b'"') => Ok(Valor::Str(self.cadena()?)),
            Some(b'n') => {
                self.literal("null")?;
                Ok(Valor::Null)
            }
            Some(b'[') => {
                self.i += 1;
                let mut itens = Vec::new();
                self.brancos();
                if self.peek() == Some(b']') {
                    self.i += 1;
                    return Ok(Valor::Lista(itens));
                }
                loop {
                    self.brancos();
                    match self.peek() {
                        Some(b'"') => itens.push(self.cadena()?),
                        other => {
                            return Err(Motivo::novo(
                                "ESQUEMA",
                                format!(
                                    "as listas só admiten cadenas, atopado {:?}",
                                    other.map(char::from)
                                ),
                            ));
                        }
                    }
                    self.brancos();
                    match self.peek() {
                        Some(b',') => self.i += 1,
                        Some(b']') => {
                            self.i += 1;
                            break;
                        }
                        other => {
                            return Err(Motivo::novo(
                                "ESQUEMA",
                                format!("separador en lista: {:?}", other.map(char::from)),
                            ));
                        }
                    }
                }
                Ok(Valor::Lista(itens))
            }
            Some(c) if c.is_ascii_digit() => {
                let inicio = self.i;
                while self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
                    self.i += 1;
                }
                let texto = std::str::from_utf8(&self.b[inicio..self.i])
                    .map_err(|_| Motivo::novo("ESQUEMA", "bytes non-UTF8"))?;
                texto
                    .parse::<u64>()
                    .map(Valor::Int)
                    .map_err(|_| Motivo::novo("ESQUEMA", format!("enteiro desbordado: {texto}")))
            }
            other => Err(Motivo::novo(
                "ESQUEMA",
                format!("valor non admitido: {:?}", other.map(char::from)),
            )),
        }
    }

    fn literal(&mut self, pal: &str) -> Result<(), Motivo> {
        if self.b[self.i..].starts_with(pal.as_bytes()) {
            self.i += pal.len();
            Ok(())
        } else {
            Err(Motivo::novo("ESQUEMA", format!("literal esperado: {pal}")))
        }
    }

    fn cadena(&mut self) -> Result<String, Motivo> {
        if self.peek() != Some(b'"') {
            return Err(Motivo::novo("ESQUEMA", "esperaba unha cadea"));
        }
        self.i += 1;
        let mut out = String::new();
        loop {
            let c = self
                .peek()
                .ok_or_else(|| Motivo::novo("ESQUEMA", "cadea sen pechar"))?;
            self.i += 1;
            match c {
                b'"' => return Ok(out),
                b'\\' => {
                    let e = self
                        .peek()
                        .ok_or_else(|| Motivo::novo("ESQUEMA", "escape truncado"))?;
                    self.i += 1;
                    match e {
                        b'"' => out.push('"'),
                        b'\\' => out.push('\\'),
                        b'/' => out.push('/'),
                        b'n' => out.push('\n'),
                        b't' => out.push('\t'),
                        b'r' => out.push('\r'),
                        b'b' => out.push('\u{8}'),
                        b'f' => out.push('\u{c}'),
                        b'u' => {
                            return Err(Motivo::novo(
                                "ESQUEMA",
                                "\\u non admitido: os campos son ASCII",
                            ))
                        }
                        other => {
                            return Err(Motivo::novo(
                                "ESQUEMA",
                                format!("escape descoñecido: \\{}", other as char),
                            ))
                        }
                    }
                }
                _ => {
                    // UTF-8 válido: copiamo byte a byte recollendo a secuencia.
                    if c < 0x80 {
                        out.push(c as char);
                    } else {
                        let inicio = self.i - 1;
                        while self.i < self.b.len() && (self.b[self.i] & 0xC0) == 0x80 {
                            self.i += 1;
                        }
                        let s = std::str::from_utf8(&self.b[inicio..self.i])
                            .map_err(|_| Motivo::novo("ESQUEMA", "secuencia UTF-8 inválida"))?;
                        out.push_str(s);
                    }
                }
            }
        }
    }
}

/// Render plano determinista: a orde é a do vector, sen espazos.
pub fn render(campos: &[(String, Valor)]) -> String {
    let mut s = String::from("{");
    for (idx, (k, v)) in campos.iter().enumerate() {
        if idx > 0 {
            s.push(',');
        }
        s.push('"');
        escape(k, &mut s);
        s.push_str("\":");
        render_valor(v, &mut s);
    }
    s.push('}');
    s
}

fn render_valor(v: &Valor, s: &mut String) {
    match v {
        Valor::Null => s.push_str("null"),
        Valor::Int(n) => s.push_str(&n.to_string()),
        Valor::Str(t) => {
            s.push('"');
            escape(t, s);
            s.push('"');
        }
        Valor::Lista(v) => {
            s.push('[');
            for (i, item) in v.iter().enumerate() {
                if i > 0 {
                    s.push(',');
                }
                s.push('"');
                escape(item, s);
                s.push('"');
            }
            s.push(']');
        }
    }
}

fn escape(t: &str, s: &mut String) {
    for c in t.chars() {
        match c {
            '"' => s.push_str("\\\""),
            '\\' => s.push_str("\\\\"),
            '\n' => s.push_str("\\n"),
            '\t' => s.push_str("\\t"),
            '\r' => s.push_str("\\r"),
            c if (c as u32) < 0x20 => s.push_str(&format!("\\u{:04x}", c as u32)),
            c => s.push(c),
        }
    }
}
