// Spielstand-Code: verschlüsselt und fälschungssicher verpackt.
//
// Warum nicht einfach Base64? Base64 ist keine Verschlüsselung – jeder kann es
// zurückrechnen, den Spielstand lesen (z. B. „dublonen: 999999“) und bearbeiten.
// Dieses Modul verschleiert den Inhalt und erkennt Änderungen: ein bearbeiteter
// Code lädt nicht mehr, sondern wird als „beschädigt“ abgewiesen.
//
// Wichtig und ehrlich: Das Spiel läuft ganz im Browser, ohne Server. Der Schlüssel
// steht also im Code und ist grundsätzlich auffindbar. Gegen jemanden, der den
// Quelltext liest und gezielt fälscht, schützt das nicht – das kann ohne Server
// niemand. Es hebt aber die Hürde deutlich: beiläufiges Mogeln am Spielstand wird
// unmöglich. Alles ist bewusst synchron und ohne fremde Bibliotheken gebaut, damit
// es im Browser (auch per file://), auf dem iPad und in den Tests gleich rechnet.
(function () {
  const GK = (window.GK = window.GK || {});

  // --- SHA-256 (synchron, reines JavaScript) -------------------------------
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  // Liefert 32 Bytes (Uint8Array) als Hash der Eingabe (Uint8Array).
  function sha256(msg) {
    const h = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    const len = msg.length;
    const bitLen = len * 8;
    // Auffüllen: 0x80, dann Nullen, dann 64-Bit-Länge – auf ein Vielfaches von 64 Bytes.
    const withOne = len + 1;
    const total = withOne + ((56 - (withOne % 64) + 64) % 64) + 8;
    const buf = new Uint8Array(total);
    buf.set(msg);
    buf[len] = 0x80;
    // Länge als 64-Bit-Zahl (die oberen Bits bleiben 0; Spielstände sind klein genug).
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 4, bitLen >>> 0, false);
    dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false);

    const w = new Uint32Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    const out = new Uint8Array(32);
    const outDv = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) outDv.setUint32(i * 4, h[i], false);
    return out;
  }

  // HMAC-SHA256: fälschungssichere Prüfsumme mit Schlüssel.
  function hmac(key, data) {
    const block = new Uint8Array(64);
    block.set(key.length > 64 ? sha256(key) : key);
    const ipad = new Uint8Array(64 + data.length);
    const opad = new Uint8Array(64 + 32);
    for (let i = 0; i < 64; i++) { ipad[i] = block[i] ^ 0x36; opad[i] = block[i] ^ 0x5c; }
    ipad.set(data, 64);
    opad.set(sha256(ipad), 64);
    return sha256(opad);
  }

  // --- Hilfsfunktionen -----------------------------------------------------
  const te = new TextEncoder();
  const td = new TextDecoder();
  const concat = (...parts) => {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };

  function randomBytes(n) {
    const out = new Uint8Array(n);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(out);
    } else {
      // Notfall-Rückfall (sollte nirgends gebraucht werden): weniger zufällig, reicht aber.
      for (let i = 0; i < n; i++) out[i] = (Math.random() * 256) & 0xff;
    }
    return out;
  }

  // Bytes <-> Base64 (stückweise, weil Safari nur begrenzt viele Argumente erlaubt).
  function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }
  function base64ToBytes(text) {
    return Uint8Array.from(atob(text), c => c.charCodeAt(0));
  }

  // Zwei Prüfsummen zeitgleich (konstant) vergleichen – kein frühes Abbrechen.
  function sameBytes(a, b, len) {
    if (a.length < len || b.length < len) return false;
    let diff = 0;
    for (let i = 0; i < len; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  // --- Schlüssel & Schlüsselstrom -----------------------------------------
  // Fester Code-Schlüssel. Nicht geheim (steht im Quelltext), dient dem Verschleiern
  // und dem Erkennen von Änderungen – nicht dem Schutz echter Geheimnisse.
  const SECRET = te.encode('Gamble-Klicker · Spielstand-Code · v1 · Rafaelo28');

  function deriveKeys(salt) {
    const base = sha256(concat(SECRET, salt));
    return {
      enc: sha256(concat(base, Uint8Array.of(0x01))),
      mac: sha256(concat(base, Uint8Array.of(0x02))),
    };
  }

  // Schlüsselstrom im Zähler-Modus: SHA256(encKey || i) als Blöcke, über die Daten XOR-t.
  function xorStream(encKey, data) {
    const out = new Uint8Array(data.length);
    const counter = new Uint8Array(4);
    const cDv = new DataView(counter.buffer);
    for (let off = 0, i = 0; off < data.length; off += 32, i++) {
      cDv.setUint32(0, i, false);
      const block = sha256(concat(encKey, counter));
      const end = Math.min(32, data.length - off);
      for (let j = 0; j < end; j++) out[off + j] = data[off + j] ^ block[j];
    }
    return out;
  }

  // --- Öffentliches Format -------------------------------------------------
  // Aufbau (dann Base64): MAGIC(1) VER(1) SALT(12) TAG(16) GEHEIMTEXT(N)
  const MAGIC = 0xa7; // ungleich '{' (0x7b), damit alte reine Base64-Codes erkennbar bleiben
  const VERSION = 1;
  const SALT_LEN = 12;
  const TAG_LEN = 16;

  GK.saveCode = {
    // Objekt -> Spielstand-Code (String).
    encode(obj) {
      const plain = te.encode(JSON.stringify(obj));
      const salt = randomBytes(SALT_LEN);
      const { enc, mac } = deriveKeys(salt);
      const cipher = xorStream(enc, plain);
      const header = Uint8Array.of(MAGIC, VERSION);
      const tag = hmac(mac, concat(header, salt, cipher)).subarray(0, TAG_LEN);
      return bytesToBase64(concat(header, salt, tag, cipher));
    },

    // Spielstand-Code (String) -> Objekt, oder null bei beschädigt/unbekannt.
    // Alte Codes (reines Base64 des JSON) werden weiter gelesen.
    decode(text) {
      let bytes;
      try {
        bytes = base64ToBytes(String(text).trim());
      } catch (e) {
        return null;
      }
      // Neues Format?
      if (bytes.length >= 2 + SALT_LEN + TAG_LEN && bytes[0] === MAGIC && bytes[1] === VERSION) {
        const header = bytes.subarray(0, 2);
        const salt = bytes.subarray(2, 2 + SALT_LEN);
        const tag = bytes.subarray(2 + SALT_LEN, 2 + SALT_LEN + TAG_LEN);
        const cipher = bytes.subarray(2 + SALT_LEN + TAG_LEN);
        const { enc, mac } = deriveKeys(salt);
        const want = hmac(mac, concat(header, salt, cipher));
        if (!sameBytes(want, tag, TAG_LEN)) return null; // verändert -> abgewiesen
        try {
          return JSON.parse(td.decode(xorStream(enc, cipher)));
        } catch (e) {
          return null;
        }
      }
      // Alter Code: reines Base64 eines JSON-Textes.
      try {
        return JSON.parse(td.decode(bytes));
      } catch (e) {
        return null;
      }
    },

    // Nur für Tests: SHA-256 als Hex (gegen bekannte Prüfwerte vergleichbar).
    _sha256hex(text) {
      return Array.from(sha256(te.encode(text)), b => b.toString(16).padStart(2, '0')).join('');
    },
  };
})();
