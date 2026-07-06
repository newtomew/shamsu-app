// crypto.ts — AES-256-GCM encrypt/decrypt using ENCRYPTION_KEY from env
// (already provisioned in Phase 1's .env.example for credential-vault use).
// Reused here (Phase 8) for the disaster-recovery backup PRD section 4.5
// requires: "Shamsu keeps an encrypted copy in a library."

import crypto from 'node:crypto';

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes) — check .env.');
  }
  return Buffer.from(hex, 'hex');
}

// Output: base64(iv[12] + authTag[16] + ciphertext)
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decrypt(encoded: string): string {
  const raw = Buffer.from(encoded, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
