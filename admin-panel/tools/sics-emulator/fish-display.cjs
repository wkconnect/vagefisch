// Display mapper for ICS689-B60 (1 line, 12 ASCII chars, no Cyrillic).
// Maps a OneBox product name -> DE display frame(s), rotated with SKU + weight.
// Rules:
//  1. Strip negated qualifiers ("без головы") so they don't false-match cut keys.
//  2. Prefer SPECIES over CUT (body part / processed form) keys.
//  3. Fall back to CUT key only if no species found (e.g. "Головы осетра" w/o species-context).
//  4. Everything trimmed to 12 chars, ASCII only.
const MAP = require('./fish-display-map.json');
const map = MAP.map, MAXLEN = MAP._maxLen;

// keys that denote a CUT / derivative, not a species
const CUT_KEYS = new Set(['головы','хребты','брюшк','стейк','филе','икра','молок']);
const speciesKeys = Object.keys(map).filter(k => !CUT_KEYS.has(k)).sort((a,b)=>b.length-a.length);
const cutKeys     = Object.keys(map).filter(k =>  CUT_KEYS.has(k)).sort((a,b)=>b.length-a.length);

function stripNegations(low){
  // "без головы", "без гол.", "б/г", "без кожи", "без хвоста", "без чешуи"
  return low
    .replace(/без\s+голов\S*/g,' ')
    .replace(/без\s+кож\S*/g,' ')
    .replace(/без\s+хвост\S*/g,' ')
    .replace(/без\s+чешу\S*/g,' ')
    .replace(/\bб\/г\b/g,' ');
}
function fit(s){ return String(s).length>MAXLEN ? String(s).slice(0,MAXLEN) : String(s); }

// -> { de, cut, key, matched }  (de = species primary; cut = optional secondary frame)
function resolve(name){
  const low = stripNegations(name.toLowerCase());
  let de=null, deKey=null, cut=null, cutKey=null;
  for (const k of speciesKeys) if (low.includes(k.toLowerCase())){ de=map[k]; deKey=k; break; }
  for (const k of cutKeys)     if (low.includes(k.toLowerCase())){ cut=map[k]; cutKey=k; break; }
  // if no species but a cut exists, cut becomes the primary display
  if (!de && cut){ de=cut; deKey=cutKey; cut=null; cutKey=null; }
  return { de: de||'?', cut, key:deKey, cutKey, matched: !!de };
}

// Rotation frames the scale shows via D "text" (each <=12 ascii). Weight is live (SI stream) not a frame.
function frames(product){
  const r = resolve(product.name);
  const f = [ fit('#'+(product.articul||product.id)), fit(r.de) ];
  if (r.cut) f.push(fit(r.cut));        // e.g. species + "Koepfe"/"Rogen"
  return { frames: f, ...r };
}
module.exports = { resolve, frames, MAXLEN };

// CLI self-test against products.json passed as arg
if (require.main === module){
  const path = process.argv[2];
  if (!path){ console.log('module ok'); process.exit(0); }
  const products = require(path);
  let ok=0;
  for (const p of products){
    const r = frames(p);
    if (r.matched) ok++;
    console.log(String(p.articul).padEnd(11),'| ',p.name.slice(0,42).padEnd(43),'-> ',r.frames.join(' | '));
  }
  console.log(`\nMATCHED ${ok}/${products.length}`);
}
