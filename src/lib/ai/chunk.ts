/**
 * Markdown knowledge-base chunking for RAG.
 *
 * Strategy (USER-MANUAL.md tasarımı):
 *   - H2 ana bölüm (e.g. "Ürünler"), H3 alt-bölüm (e.g. "Yeni ürün ekleme"),
 *     H4 alt-altbölüm (e.g. "Bölüm 1: Temel bilgiler").
 *   - Atomik chunk = bir H3 başlığı + altındaki tüm içerik (H4'ler dahil).
 *   - H3 yoksa H2 tek chunk olur.
 *   - H3 içeriği MAX_CHUNK_TOKENS aşıyorsa H4 sub-headers ile alt-böl.
 *   - H4 de fazla geliyorsa boş-satır paragraph-pack.
 *   - H1 (ana başlık) ve "İçindekiler" section'ı atlanır.
 *   - Code block (```...```) içindeki '#' satırları header sayılmaz.
 *
 * Token estimate: TR text için yaklaşık 3.5 char/token (English için 4 char/token,
 * Türkçe daha kısa kelime + ek-fiil yapısı nedeniyle daha agresif).
 */

export const MAX_CHUNK_TOKENS = 800;
export const TARGET_CHUNK_TOKENS = 500;
export const MIN_CHUNK_TOKENS = 30;
export const TR_CHARS_PER_TOKEN = 3.5;

export interface Header {
  lineIndex: number; // 0-indexed
  level: 1 | 2 | 3 | 4;
  title: string;
}

export interface Chunk {
  id: string;
  level: number;
  section: string;
  title: string;
  breadcrumb: string;
  content: string;
  charCount: number;
  tokenEstimate: number;
  sourceStartLine: number; // 1-indexed (kullanıcı dosyada satır numarası ile bakar)
  sourceEndLine: number;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.round(text.length / TR_CHARS_PER_TOKEN));
}

/**
 * Parse markdown headers (H1-H4). Code block içindeki '#' satırları yok sayılır.
 */
export function parseHeadersSkippingCodeBlocks(lines: string[]): Header[] {
  const headers: Header[] = [];
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const m = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (m) {
      const level = m[1].length as 1 | 2 | 3 | 4;
      const title = m[2].trim();
      headers.push({ lineIndex: i, level, title });
    }
  }
  return headers;
}

/**
 * Boş satırla ayrılmış paragraflara böl.
 */
export function paragraphSplit(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Paragrafları greedy şekilde pack et: target'a ulaşınca yeni chunk, max'ı asla aşma
 * (tek paragraf max'ı tek başına aşıyorsa zorla kabul edilir).
 */
export function packParagraphs(
  paragraphs: string[],
  targetTokens: number = TARGET_CHUNK_TOKENS,
  maxTokens: number = MAX_CHUNK_TOKENS,
): string[] {
  if (paragraphs.length === 0) return [];
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;
  for (const p of paragraphs) {
    const pTokens = estimateTokens(p);
    if (current.length === 0) {
      current.push(p);
      currentTokens = pTokens;
      continue;
    }
    const wouldBe = currentTokens + pTokens;
    if (wouldBe > maxTokens || (currentTokens >= targetTokens && wouldBe > targetTokens)) {
      chunks.push(current.join('\n\n'));
      current = [p];
      currentTokens = pTokens;
    } else {
      current.push(p);
      currentTokens = wouldBe;
    }
  }
  if (current.length > 0) chunks.push(current.join('\n\n'));
  return chunks;
}

interface HeaderRange extends Header {
  startLine: number;
  endLine: number;
}

/**
 * Headers → line range. EndLine = aynı veya daha yüksek seviyedeki bir sonraki başlığın öncesi
 * (markdown TOC mantığı). Bu sayede H3 atom kendi altındaki H4'leri de kapsar.
 */
function buildRanges(headers: Header[], totalLines: number): HeaderRange[] {
  return headers.map((h, idx) => {
    let endLine = totalLines - 1;
    for (let j = idx + 1; j < headers.length; j++) {
      if (headers[j].level <= h.level) {
        endLine = headers[j].lineIndex - 1;
        break;
      }
    }
    return {
      ...h,
      startLine: h.lineIndex,
      endLine,
    };
  });
}

function rangeContent(lines: string[], start: number, end: number): string {
  return lines.slice(start, end + 1).join('\n').trimEnd();
}

interface EmitContext {
  chunks: Chunk[];
  nextId: number;
}

function emitChunk(
  ctx: EmitContext,
  params: {
    level: number;
    section: string;
    title: string;
    breadcrumb: string;
    content: string;
    sourceStartLine: number; // 0-indexed
    sourceEndLine: number; // 0-indexed
  },
): void {
  const clean = params.content.trim();
  if (clean.length < 10) return; // başlık-tek-satır gibi boş chunk'ları sızdırma
  ctx.chunks.push({
    id: `c-${String(ctx.nextId).padStart(3, '0')}`,
    level: params.level,
    section: params.section,
    title: params.title,
    breadcrumb: params.breadcrumb,
    content: clean,
    charCount: clean.length,
    tokenEstimate: estimateTokens(clean),
    sourceStartLine: params.sourceStartLine + 1,
    sourceEndLine: params.sourceEndLine + 1,
  });
  ctx.nextId++;
}

/**
 * Bir bölüm içeriğini gerekirse H4 ile veya paragraph-pack ile alt-böl.
 * level: ana chunk'ın level'ı (2 veya 3).
 */
function emitOrSplit(
  ctx: EmitContext,
  lines: string[],
  params: {
    level: 2 | 3;
    section: string;
    title: string;
    breadcrumb: string;
    content: string;
    startLine: number; // 0-indexed dosya satırı
    endLine: number; // 0-indexed
  },
): void {
  const tokens = estimateTokens(params.content);
  if (tokens <= MAX_CHUNK_TOKENS) {
    emitChunk(ctx, {
      level: params.level,
      section: params.section,
      title: params.title,
      breadcrumb: params.breadcrumb,
      content: params.content,
      sourceStartLine: params.startLine,
      sourceEndLine: params.endLine,
    });
    return;
  }

  // H4 sub-split (sadece level=3 için anlamlı — level=2 zaten H3 ile alt-bölünmüş olur,
  // burada level=2 alındıysa H3 children yok demektir).
  if (params.level === 3) {
    const contentLines = params.content.split('\n');
    const innerHeaders: Array<{ relativeLine: number; title: string }> = [];
    let inCode = false;
    for (let i = 0; i < contentLines.length; i++) {
      if (/^```/.test(contentLines[i])) {
        inCode = !inCode;
        continue;
      }
      if (inCode) continue;
      const m = contentLines[i].match(/^####\s+(.+?)\s*$/);
      if (m) innerHeaders.push({ relativeLine: i, title: m[1].trim() });
    }

    if (innerHeaders.length > 0) {
      // H3 intro (firstH4'e kadar) eğer non-trivial ise
      const introEnd = innerHeaders[0].relativeLine - 1;
      const intro = contentLines.slice(0, innerHeaders[0].relativeLine).join('\n').trim();
      if (estimateTokens(intro) >= MIN_CHUNK_TOKENS) {
        emitChunk(ctx, {
          level: 3,
          section: params.section,
          title: `${params.title} (giriş)`,
          breadcrumb: `${params.breadcrumb} > Giriş`,
          content: intro,
          sourceStartLine: params.startLine,
          sourceEndLine: params.startLine + introEnd,
        });
      }
      // Her H4 ayrı chunk (gerekirse paragraph-pack)
      for (let i = 0; i < innerHeaders.length; i++) {
        const h4 = innerHeaders[i];
        const h4Start = h4.relativeLine;
        const h4End = i + 1 < innerHeaders.length
          ? innerHeaders[i + 1].relativeLine - 1
          : contentLines.length - 1;
        const h4Content = contentLines.slice(h4Start, h4End + 1).join('\n').trim();
        const h4Breadcrumb = `${params.breadcrumb} > ${h4.title}`;
        const h4Tokens = estimateTokens(h4Content);
        if (h4Tokens > MAX_CHUNK_TOKENS) {
          const paragraphs = paragraphSplit(h4Content);
          const packed = packParagraphs(paragraphs);
          packed.forEach((p, idx) => {
            emitChunk(ctx, {
              level: 4,
              section: params.section,
              title: packed.length > 1 ? `${h4.title} (parça ${idx + 1}/${packed.length})` : h4.title,
              breadcrumb: h4Breadcrumb,
              content: p,
              sourceStartLine: params.startLine + h4Start,
              sourceEndLine: params.startLine + h4End,
            });
          });
        } else {
          emitChunk(ctx, {
            level: 4,
            section: params.section,
            title: h4.title,
            breadcrumb: h4Breadcrumb,
            content: h4Content,
            sourceStartLine: params.startLine + h4Start,
            sourceEndLine: params.startLine + h4End,
          });
        }
      }
      return;
    }
  }

  // Fallback: paragraph-pack
  const paragraphs = paragraphSplit(params.content);
  const packed = packParagraphs(paragraphs);
  packed.forEach((p, idx) => {
    emitChunk(ctx, {
      level: params.level,
      section: params.section,
      title: packed.length > 1 ? `${params.title} (parça ${idx + 1}/${packed.length})` : params.title,
      breadcrumb: params.breadcrumb,
      content: p,
      sourceStartLine: params.startLine,
      sourceEndLine: params.endLine,
    });
  });
}

/**
 * Markdown lines'ı atomik chunk'lara böl.
 */
export function splitChunks(lines: string[]): Chunk[] {
  const headers = parseHeadersSkippingCodeBlocks(lines);
  const ranges = buildRanges(headers, lines.length);

  // İçindekiler section'ı tespit et — H2 'İçindekiler' başlığı + içeriği skip
  const tocIdx = ranges.findIndex((r) => r.level === 2 && r.title.trim() === 'İçindekiler');
  const tocStart = tocIdx >= 0 ? ranges[tocIdx].lineIndex : -1;
  const tocEnd = tocIdx >= 0 ? ranges[tocIdx].endLine : -1;
  const isInToc = (r: HeaderRange): boolean =>
    tocStart >= 0 && r.lineIndex >= tocStart && r.lineIndex <= tocEnd;

  const ctx: EmitContext = { chunks: [], nextId: 1 };

  for (let i = 0; i < ranges.length; i++) {
    const h = ranges[i];
    if (h.level === 1) continue; // ana başlık
    if (isInToc(h)) continue; // İçindekiler

    if (h.level === 2) {
      const section = h.title;
      const h3Children = ranges.filter(
        (r) => r.lineIndex > h.lineIndex && r.lineIndex <= h.endLine && r.level === 3,
      );
      if (h3Children.length === 0) {
        const content = rangeContent(lines, h.startLine, h.endLine);
        emitOrSplit(ctx, lines, {
          level: 2,
          section,
          title: h.title,
          breadcrumb: section,
          content,
          startLine: h.startLine,
          endLine: h.endLine,
        });
      } else {
        // H2 intro (firstH3'e kadar) eğer non-trivial ise
        const firstH3Line = h3Children[0].lineIndex;
        if (firstH3Line > h.startLine + 1) {
          const intro = rangeContent(lines, h.startLine, firstH3Line - 1);
          if (estimateTokens(intro) >= MIN_CHUNK_TOKENS) {
            emitChunk(ctx, {
              level: 2,
              section,
              title: `${h.title} (giriş)`,
              breadcrumb: `${section} > Giriş`,
              content: intro,
              sourceStartLine: h.startLine,
              sourceEndLine: firstH3Line - 1,
            });
          }
        }
        // H3 children kendi iterasyonlarında işlenir
      }
    } else if (h.level === 3) {
      // Find ancestor H2 (en yakın geriye)
      let section = '';
      for (let j = i - 1; j >= 0; j--) {
        if (ranges[j].level === 2) {
          section = ranges[j].title;
          break;
        }
        if (ranges[j].level === 1) break;
      }
      const content = rangeContent(lines, h.startLine, h.endLine);
      emitOrSplit(ctx, lines, {
        level: 3,
        section,
        title: h.title,
        breadcrumb: section ? `${section} > ${h.title}` : h.title,
        content,
        startLine: h.startLine,
        endLine: h.endLine,
      });
    }
    // level 4: parent H3 emitOrSplit içinde halloluyor (H3 büyükse H4 sub-chunk yapılıyor).
  }

  return ctx.chunks;
}
