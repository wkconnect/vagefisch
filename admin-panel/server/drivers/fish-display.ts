/**
 * Fish display mapper for Mettler-Toledo ICS689-B60 (1 line, 12 ASCII chars, no Cyrillic).
 *
 * OneBox product names are mostly Russian (Cyrillic) with qualifiers that do not fit a
 * 12-char single-line remote display; sending them raw yields a DR (cut-off) error.
 * This module translates a product name into a short German display frame set.
 *
 * Rules:
 *  1. Strip negated qualifiers ("без головы") so they don't false-match cut keys.
 *  2. Prefer SPECIES over CUT (body part / processed form) keys.
 *  3. Fall back to a CUT key only if no species matched (e.g. "Головы осетра").
 *  4. Everything trimmed to maxLen chars, non-ASCII stripped as last-resort fallback.
 *
 * Dictionary source: OneBox product/get (555 products). STARTER map — refine with client.
 * Keep in sync with tools/sics-emulator/fish-display-map.json.
 */

export const MAX_DISPLAY_LEN = 12;

// RU keyword (lowercase, substring match) -> DE display name (<= 12 ASCII chars)
const FISH_MAP: Record<string, string> = {
  'лосос': 'Lachs', 'лаксовы': 'Lachs', 'лаксфорел': 'Lachsforel', 'лаксфореле': 'Lachsforel',
  'лососев': 'Lachsforel', 'форел': 'Forelle', 'карп': 'Karpfen', 'сазан': 'Karpfen',
  'карас': 'Karausche', 'толстолоб': 'Silberkarp', 'амур': 'Graskarpf', 'щука': 'Hecht',
  'судак': 'Zander', 'лещ': 'Brasse', 'красноперк': 'Rotfeder', 'окунь речн': 'Flussbarsc',
  'окунь красн': 'Rotbarsch', 'красный окун': 'Rotbarsch', 'нильск': 'Nilbarsch', 'осетр': 'Stoer',
  'осётр': 'Stoer', 'стерляд': 'Stoer', 'сом': 'Wels', 'хамса': 'Sardelle', 'анчоус': 'Sardelle',
  'сардин': 'Sardine', 'морской петух': 'Knurrhahn', 'ставрид': 'Stoecker', 'витлинг': 'Wittling',
  'морской угор': 'Meeraal', 'камбала': 'Scholle', 'флундер': 'Flunder', 'клеше': 'Kliesche',
  'дракончик': 'Petermann', 'акула': 'Hai', 'aкула': 'Hai', 'кефал': 'Meeraesche',
  'тунец': 'Thunfisch', 'тунца': 'Thunfisch', 'корвин': 'Umberfisc', 'сибас': 'Wolfsbars',
  'дорада': 'Dorade', 'дорады': 'Dorade', 'осьминог': 'Oktopus', 'осминог': 'Oktopus',
  'кальмар': 'Kalmar', 'хек': 'Seehecht', 'палтус': 'Heilbutt', 'heilbutt': 'Heilbutt',
  'гренадир': 'Grenadier', 'мойва': 'Lodde', 'салака': 'Stroemling', 'шпрот': 'Sprotte',
  'сельд': 'Hering', 'скат': 'Rochen', 'корюшк': 'Stint', 'зубатк': 'Seewolf', 'треска': 'Kabeljau',
  'трески': 'Kabeljau', 'ленг': 'Leng', 'скумбри': 'Makrele', 'сайд': 'Seelachs', 'плотв': 'Ploetze',
  'вобл': 'Ploetze', 'мидии': 'Muscheln', 'мидий': 'Muscheln', 'устриц': 'Austern',
  'улитк': 'Schnecken', 'паучий краб': 'Seespinne', 'голубой краб': 'Blaukrabbe', 'краб': 'Krabbe',
  'омар': 'Hummer', 'аргентинск': 'Garnelen', 'креветк': 'Garnelen', 'рак': 'Flusskrebs',
  'барабул': 'Rotbarbe', 'жерих': 'Rapfen', 'горбуш': 'Buckellac', 'масляной рыб': 'Butterfis',
  'масляная рыб': 'Butterfis', 'рыба-меч': 'Schwertf', 'рыба меч': 'Schwertf', 'рыбы меч': 'Schwertf',
  'schwertfisch': 'Schwertf', 'меч': 'Schwertf', 'линь': 'Schleie', 'полосатик': 'Streifenf',
  'barabul': 'Rotbarbe', 'икра': 'Rogen', 'молок': 'Milch', 'головы': 'Koepfe', 'хребты': 'Graeten',
  'брюшк': 'Bauchlappe', 'стейк': 'Steak', 'филе': 'Filet', 'rotbarsch': 'Rotbarsch', 'stör': 'Stoer',
};

// Keys denoting a CUT / derivative, not a species — matched only as a secondary frame.
const CUT_KEYS = new Set(['головы', 'хребты', 'брюшк', 'стейк', 'филе', 'икра', 'молок']);

const speciesKeys = Object.keys(FISH_MAP).filter(k => !CUT_KEYS.has(k)).sort((a, b) => b.length - a.length);
const cutKeys = Object.keys(FISH_MAP).filter(k => CUT_KEYS.has(k)).sort((a, b) => b.length - a.length);

function stripNegations(low: string): string {
  return low
    .replace(/без\s+голов\S*/g, ' ')
    .replace(/без\s+кож\S*/g, ' ')
    .replace(/без\s+хвост\S*/g, ' ')
    .replace(/без\s+чешу\S*/g, ' ')
    .replace(/\bб\/г\b/g, ' ');
}

/** ASCII-only, trimmed to maxLen. Last-resort fallback so Cyrillic never reaches the scale. */
export function fitAscii(s: string, maxLen: number = MAX_DISPLAY_LEN): string {
  const ascii = (s || '').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
  return ascii.length > maxLen ? ascii.slice(0, maxLen) : ascii;
}

export interface ResolvedDisplay {
  de: string;          // primary display name (species, or cut if no species)
  cut: string | null;  // optional secondary frame (Koepfe/Rogen/Filet/...)
  key: string | null;
  cutKey: string | null;
  matched: boolean;
}

/** Resolve a (Russian) product name to a German display name + optional cut frame. */
export function resolveDisplay(name: string): ResolvedDisplay {
  const low = stripNegations((name || '').toLowerCase());
  let de: string | null = null, deKey: string | null = null;
  let cut: string | null = null, cutKey: string | null = null;
  for (const k of speciesKeys) if (low.includes(k)) { de = FISH_MAP[k]; deKey = k; break; }
  for (const k of cutKeys) if (low.includes(k)) { cut = FISH_MAP[k]; cutKey = k; break; }
  // no species but a cut exists -> cut becomes the primary display
  if (!de && cut) { de = cut; deKey = cutKey; cut = null; cutKey = null; }
  return { de: de ?? '', cut, key: deKey, cutKey, matched: !!de };
}

export interface FrameInput {
  name: string;
  sku?: string;
  articul?: string;
  targetWeight?: number;
  unit?: string;
}

/**
 * Build the rotation frames for a selected product. Each frame is <= maxLen ASCII chars.
 * Order: [#SKU, DE-species, (cut), (target weight)]. Frames with no data are omitted.
 */
export function productFrames(p: FrameInput, maxLen: number = MAX_DISPLAY_LEN): string[] {
  const r = resolveDisplay(p.name);
  const frames: string[] = [];
  const sku = p.sku || p.articul;
  if (sku) frames.push(fitAscii('#' + sku, maxLen));
  // primary name: resolved DE, else ASCII-safe truncation of the raw name (never Cyrillic)
  frames.push(r.matched ? fitAscii(r.de, maxLen) : (fitAscii(p.name, maxLen) || '?'));
  if (r.cut) frames.push(fitAscii(r.cut, maxLen));
  if (p.targetWeight !== undefined) frames.push(fitAscii(`S:${p.targetWeight}${p.unit || 'kg'}`, maxLen));
  return frames.filter(f => f.length > 0);
}

export default { MAX_DISPLAY_LEN, resolveDisplay, productFrames, fitAscii };
