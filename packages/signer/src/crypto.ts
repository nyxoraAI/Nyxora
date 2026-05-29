import crypto from 'crypto';

export interface EncryptedKeystore {
    salt: string;
    iv: string;
    authTag: string;
    encryptedData: string;
}

export function encryptKey(privateKey: string, password: string): EncryptedKeystore {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return {
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag,
        encryptedData: encrypted
    };
}

export function decryptKey(keystore: EncryptedKeystore, password: string): string {
    const salt = Buffer.from(keystore.salt, 'hex');
    const iv = Buffer.from(keystore.iv, 'hex');
    const authTag = Buffer.from(keystore.authTag, 'hex');
    const encryptedText = Buffer.from(keystore.encryptedData, 'hex');

    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}
