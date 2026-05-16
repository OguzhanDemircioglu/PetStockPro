import { describe, it, expect } from 'vitest';
import { validateSelectQuery, dbInspectorQuerySchema } from './db-inspector';

describe('dbInspectorQuerySchema', () => {
  it('valid input', () => {
    expect(
      dbInspectorQuerySchema.safeParse({ sql: 'SELECT 1 FROM users' }).success,
    ).toBe(true);
  });

  it('reject — çok kısa', () => {
    expect(dbInspectorQuerySchema.safeParse({ sql: 'SELECT' }).success).toBe(false);
  });

  it('reject — çok uzun', () => {
    expect(
      dbInspectorQuerySchema.safeParse({ sql: 'SELECT ' + 'a'.repeat(2000) }).success,
    ).toBe(false);
  });
});

describe('validateSelectQuery', () => {
  it('happy — basit SELECT', () => {
    const r = validateSelectQuery('SELECT id, email FROM petstockpro.users LIMIT 5');
    expect(r.ok).toBe(true);
  });

  it('happy — SELECT case insensitive (select)', () => {
    const r = validateSelectQuery('select id from petstockpro.users');
    expect(r.ok).toBe(true);
  });

  it('happy — WITH (CTE)', () => {
    const r = validateSelectQuery(
      'WITH x AS (SELECT 1 AS a) SELECT * FROM x',
    );
    expect(r.ok).toBe(true);
  });

  it('happy — trailing semicolon kaldırılır', () => {
    const r = validateSelectQuery('SELECT 1;   ');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalized).toBe('SELECT 1');
  });

  it('reject — DROP TABLE', () => {
    const r = validateSelectQuery('DROP TABLE users');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_select');
  });

  it('reject — UPDATE', () => {
    const r = validateSelectQuery('UPDATE users SET email=null');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_select');
  });

  it('reject — DELETE', () => {
    const r = validateSelectQuery('DELETE FROM users');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_select');
  });

  it('reject — chain attack SELECT 1; DROP TABLE', () => {
    const r = validateSelectQuery('SELECT 1; DROP TABLE users');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('multiple_statements');
  });

  it('reject — SELECT içinde DELETE keyword', () => {
    // Subquery'de bile forbidden keyword bulunamaz
    const r = validateSelectQuery('SELECT id FROM (DELETE FROM x RETURNING *) AS sub');
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'forbidden_keyword') {
      expect(r.keyword).toBe('DELETE');
    }
  });

  it('reject — TRUNCATE', () => {
    const r = validateSelectQuery('TRUNCATE TABLE users');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_select');
  });

  it('reject — ALTER', () => {
    const r = validateSelectQuery('ALTER TABLE users DROP COLUMN x');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_select');
  });

  it('reject — CREATE', () => {
    const r = validateSelectQuery('CREATE TABLE x (id int)');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_select');
  });

  it('reject — GRANT', () => {
    const r = validateSelectQuery('GRANT ALL ON TABLE x TO public');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_select');
  });

  it('reject — SET statement_timeout (configuration drift)', () => {
    const r = validateSelectQuery('SET statement_timeout = 60000');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_select');
  });

  it('reject — CALL procedure', () => {
    const r = validateSelectQuery('CALL my_proc()');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_select');
  });

  it('happy — kolon adında "update" alt-dizesi (last_update_time) — word boundary ayırır', () => {
    // \bUPDATE\b — underscore word char olduğu için "last_update_time"
    // içindeki "update" word boundary'ye sahip değil → reject edilmez.
    const r = validateSelectQuery('SELECT last_update_time FROM users');
    expect(r.ok).toBe(true);
  });

  it('reject — kolon olarak "update" tek başına forbidden', () => {
    const r = validateSelectQuery('SELECT update FROM users');
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'forbidden_keyword') {
      expect(r.keyword).toBe('UPDATE');
    }
  });
});
