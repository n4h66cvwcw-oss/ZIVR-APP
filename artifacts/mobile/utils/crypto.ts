import CryptoJS from "crypto-js";

export function encryptMessage(text: string, key: string): string {
  if (!text || !key) return text;
  try {
    return CryptoJS.AES.encrypt(text, key).toString();
  } catch {
    return text;
  }
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
  try {
    if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
      const arr = new Uint8Array(32);
      globalThis.crypto.getRandomValues(arr);
      return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return CryptoJS.lib.WordArray.random(32).toString();
  } catch {
    let key = "";
    for (let i = 0; i < 64; i++) {
      key += Math.floor(Math.random() * 16).toString(16);
    }
    return key;
  }
}

export function deriveKeyFromPasscode(passcode: string, salt: string): string {
  return CryptoJS.PBKDF2(passcode, salt, {
    keySize: 256 / 32,
    iterations: 1000,
  }).toString();
}
