"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionToken = getSessionToken;
let sessionToken = null;
const crypto_1 = __importDefault(require("crypto"));
function getSessionToken() {
    if (!sessionToken) {
        sessionToken = crypto_1.default.randomBytes(32).toString('hex');
    }
    return sessionToken;
}
