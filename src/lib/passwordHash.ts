import crypto from 'crypto';

/**
 * 將密碼轉換為 SHA-256 hex 格式
 * 後端規定所有密碼傳輸必須是 SHA-256 hex 字串（長度 64）
 */
export function hashPasswordToSHA256(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');
}
