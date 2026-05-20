import { describe, it, expect } from 'vitest';
import {
  decodeHtmlEntities,
  normalizeInlineWhitespace,
  normalizeProductName,
  normalizeProductDescription,
  cleanProductTextFields,
} from './text-cleanup';

describe('decodeHtmlEntities', () => {
  it('numeric apostrophe &#039; → \'', () => {
    expect(decodeHtmlEntities('Vet&#039;s Plus')).toBe("Vet's Plus");
  });

  it('named &amp; / &quot; / &lt; / &gt; / &nbsp;', () => {
    expect(decodeHtmlEntities('A &amp; B')).toBe('A & B');
    expect(decodeHtmlEntities('&quot;hi&quot;')).toBe('"hi"');
    expect(decodeHtmlEntities('a &lt; b &gt; c')).toBe('a < b > c');
    expect(decodeHtmlEntities('x&nbsp;y')).toBe('x y');
  });

  it('hex entity &#x27; → \'', () => {
    expect(decodeHtmlEntities('don&#x27;t')).toBe("don't");
  });

  it('bilinmeyen entity dokunulmaz', () => {
    expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;');
  });

  it('control character düşük kod blokları korunur (33 alt)', () => {
    expect(decodeHtmlEntities('&#0;&#7;')).toBe('&#0;&#7;');
  });

  it('idempotent — temiz string değişmez', () => {
    const clean = "Vet's Plus & Co";
    expect(decodeHtmlEntities(clean)).toBe(clean);
  });

  it('boş / null-equivalent input', () => {
    expect(decodeHtmlEntities('')).toBe('');
  });
});

describe('normalizeInlineWhitespace', () => {
  it('multi-space → single + trim', () => {
    expect(normalizeInlineWhitespace('  a    b   c ')).toBe('a b c');
  });

  it('newline korunur', () => {
    expect(normalizeInlineWhitespace('a\nb')).toBe('a\nb');
  });

  it('idempotent', () => {
    expect(normalizeInlineWhitespace('a b c')).toBe('a b c');
  });
});

describe('normalizeProductName', () => {
  it('html entity + multi-ws + trim', () => {
    expect(normalizeProductName('  Vet&#039;s   Plus  ')).toBe("Vet's Plus");
  });

  it('newline da boşluğa düşer (tek satırlık ürün adı)', () => {
    expect(normalizeProductName('Pro Plan\nSterilised')).toBe('Pro Plan Sterilised');
  });

  it('idempotent', () => {
    expect(normalizeProductName("Vet's Plus")).toBe("Vet's Plus");
  });
});

describe('normalizeProductDescription', () => {
  it('null → null', () => {
    expect(normalizeProductDescription(null)).toBeNull();
  });

  it('undefined → null', () => {
    expect(normalizeProductDescription(undefined)).toBeNull();
  });

  it('html entity decode + paragraf koru', () => {
    const input = 'A &amp; B\n\n  multi-ws   line';
    expect(normalizeProductDescription(input)).toBe('A & B\n\nmulti-ws line');
  });

  it('\\r\\n → \\n', () => {
    expect(normalizeProductDescription('a\r\nb\r\nc')).toBe('a\nb\nc');
  });

  it('baş/son boş satırları sil', () => {
    expect(normalizeProductDescription('\n\nabc\n\n')).toBe('abc');
  });

  it('idempotent', () => {
    const clean = 'a\nb\nc';
    expect(normalizeProductDescription(clean)).toBe(clean);
  });
});

describe('cleanProductTextFields', () => {
  it('changed=true html entity var', () => {
    const r = cleanProductTextFields({
      name: 'Vet&#039;s Plus',
      description: 'A &amp; B',
    });
    expect(r.name).toBe("Vet's Plus");
    expect(r.description).toBe('A & B');
    expect(r.changed).toBe(true);
  });

  it('changed=false zaten temiz', () => {
    const r = cleanProductTextFields({
      name: 'Pro Plan',
      description: 'Açıklama satırı',
    });
    expect(r.changed).toBe(false);
  });

  it('description null geçilebilir', () => {
    const r = cleanProductTextFields({ name: 'Pro Plan' });
    expect(r.description).toBeNull();
    expect(r.changed).toBe(false);
  });
});
