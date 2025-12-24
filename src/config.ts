import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
// Check both root and src directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, './.env') });

export const config = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    targetWalletAddress: process.env.TARGET_WALLET_ADDRESS || '',
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '300000', 10),
};

if (!config.telegramBotToken) {
    console.warn('WARNING: TELEGRAM_BOT_TOKEN is not set.');
}
if (!config.telegramChatId) {
    console.warn('WARNING: TELEGRAM_CHAT_ID is not set.');
}
if (!config.targetWalletAddress) {
    console.warn('WARNING: TARGET_WALLET_ADDRESS is not set.');
}
