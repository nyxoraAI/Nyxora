"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptKey = encryptKey;
exports.decryptKey = decryptKey;
const crypto_1 = __importDefault(require("crypto"));
function encryptKey(privateKey, password) {
    const salt = crypto_1.default.randomBytes(16);
    const key = crypto_1.default.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
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
function decryptKey(keystore, password) {
    const salt = Buffer.from(keystore.salt, 'hex');
    const iv = Buffer.from(keystore.iv, 'hex');
    const authTag = Buffer.from(keystore.authTag, 'hex');
    const encryptedText = Buffer.from(keystore.encryptedData, 'hex');
    const key = crypto_1.default.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
