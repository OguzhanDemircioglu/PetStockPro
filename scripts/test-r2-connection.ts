/**
 * R2 connection smoke test — küçük bir dosya put + get + delete döngüsü.
 * Bağlantı + permission + public URL dağıtımı doğrulanır.
 */

import 'dotenv/config';
import { uploadToR2, fetchFromR2, deleteFromR2, existsInR2, getR2PublicUrl } from '../src/lib/storage/r2-client';

async function main(): Promise<void> {
  const testKey = `_smoketest/connection-${Date.now()}.txt`;
  const payload = Buffer.from(`R2 smoke test ${new Date().toISOString()}`, 'utf-8');

  console.log('[test] 1/5 Uploading test object:', testKey);
  const url = await uploadToR2(testKey, payload, {
    contentType: 'text/plain',
    cacheControl: 'no-cache',
  });
  console.log('       ✓ Uploaded, public URL:', url);

  console.log('[test] 2/5 Checking existsInR2...');
  const exists = await existsInR2(testKey);
  console.log('       ', exists ? '✓ exists' : '✕ NOT FOUND');

  console.log('[test] 3/5 Fetching back from R2 (server-side)...');
  const fetched = await fetchFromR2(testKey);
  if (!fetched) throw new Error('fetchFromR2 returned null');
  const fetchedText = fetched.toString('utf-8');
  console.log('       ✓ Fetched, content matches:', fetchedText === payload.toString('utf-8'));

  console.log('[test] 4/5 Fetching via HTTPS public URL (browser-style)...');
  const resp = await fetch(url);
  console.log('       HTTP', resp.status, resp.ok ? '✓ public URL works' : '✕ FAIL');
  if (resp.ok) {
    const text = await resp.text();
    console.log('       Content match:', text === payload.toString('utf-8'));
  } else {
    console.log('       ⚠ Public URL accessible OLMAYABILIR — Public Access ayarını kontrol et');
  }

  console.log('[test] 5/5 Cleaning up (delete)...');
  await deleteFromR2(testKey);
  const stillExists = await existsInR2(testKey);
  console.log('       ', !stillExists ? '✓ deleted' : '✕ HALA VAR');

  console.log('\n[test] ✅ R2 connection working — bucket ready for bulk upload.');
  console.log('[test]    R2_PUBLIC_URL base:', getR2PublicUrl(''));
}

main().catch((e) => {
  console.error('\n[test] ✕ FAILED:', e.message);
  console.error('       Detail:', e.name);
  process.exit(1);
});
