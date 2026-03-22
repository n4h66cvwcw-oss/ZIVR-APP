import CryptoJS from "crypto-js";

export function encryptMessage(text: string, key: string): string {
  if (!text || !key) return text;
  return CryptoJS.AES.encrypt(text, key).toString();
}

export function decryptMessage(ciphertext: string, key: string): string {
  if (!ciphertext || !key) return ciphertext;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8) || ciphertext;
  } catch {
    return ciphertext;
  }
}

export function hashPasscode(passcode: string): string {
  return CryptoJS.SHA256(passcode).toString();
}

export function generateEncryptionKey(): string {
  return CryptoJS.lib.WordArray.random(32).toString();
}

export function deriveKeyFromPasscode(passcode: string, salt: string): string {
  return CryptoJS.PBKDF2(passcode, salt, {
    keySize: 256 / 32,
    iterations: 1000,
  }).toString();
}
