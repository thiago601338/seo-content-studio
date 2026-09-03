import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function keyBuffer() {
  const raw = process.env.SITES_ENCRYPTION_KEY || '';
  if (!raw) throw new Error('SITES_ENCRYPTION_KEY nao foi configurada.');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('SITES_ENCRYPTION_KEY precisa ter exatamente 32 bytes em base64.');
  }
  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptSecret(payload: string) {
  const parts = payload.split('.');
  if (parts.length !== 3) throw new Error('Credencial criptografada invalida.');
  const [ivRaw, tagRaw, dataRaw] = parts;
  const iv = Buffer.from(ivRaw, 'base64url');
  const tag = Buffer.from(tagRaw, 'base64url');
  const encrypted = Buffer.from(dataRaw, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', keyBuffer(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
