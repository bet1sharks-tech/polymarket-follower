import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';
import { PolymarketClient, Position } from './polymarket';
import { TelegramNotifier } from './telegram';

const DATA_DIR = path.join(process.cwd(), '.data');
const PERSISTENCE_FILE = path.join(DATA_DIR, 'notified_positions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function loadNotifiedPositions(): Set<string> {
    try {
        if (fs.existsSync(PERSISTENCE_FILE)) {
            const data = fs.readFileSync(PERSISTENCE_FILE, 'utf8');
            const ids = JSON.parse(data);
            console.log(`Loaded ${ids.length} already notified positions.`);
            return new Set(ids);
        }
    } catch (error) {
        console.error('Error loading notified positions:', error);
    }
    return new Set();
}

function saveNotifiedPosition(currentIds: Set<string>) {
    try {
        const ids = Array.from(currentIds);
        const tempFile = `${PERSISTENCE_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(ids, null, 2));
        fs.renameSync(tempFile, PERSISTENCE_FILE);
        console.log(`[Persistence] Saved ${ids.length} positions to disk.`);
    } catch (error) {
        console.error('[Persistence] Error saving notified positions:', error);
    }
}

async function main() {
    console.log('Starting Polymarket Follower (Position Monitor)...');
    console.log(`Tracking Wallet: ${config.targetWalletAddress}`);
    console.log(`Poll Interval: ${config.pollIntervalMs}ms`);

    const polyClient = new PolymarketClient(config.targetWalletAddress);
    const telegramBot = new TelegramNotifier(config.telegramBotToken, config.telegramChatId);

    // Load persisted conditionIds
    const notifiedPositions = loadNotifiedPositions();

    let consecutiveErrors = 0;
    let lastHeartbeat = Date.now();
    const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    const poll = async () => {
        try {
            console.log(`[${new Date().toISOString()}] Polling positions...`);

            // Check for Daily Heartbeat
            if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
                await telegramBot.sendMessage(`💚 <b>Bot Heartbeat</b>\nThe bot is online and actively monitoring wallet: <code>${config.targetWalletAddress}</code>`);
                lastHeartbeat = Date.now();
            }

            const positions = await polyClient.fetchPositions();

            // Success! Reset consecutive errors
            consecutiveErrors = 0;

            // Filter for positions:
            // 1. Value >= $5000
            // 2. Not already notified (using asset ID)
            // 3. Price is between 0.10 and 0.90
            const largePositions = positions.filter((p: Position) => {
                const isLarge = p.currentValue >= 5000;
                const isNew = !notifiedPositions.has(p.asset);

                // Use avgPrice or curPrice, filtered between 0.10 and 0.90
                const price = p.averagePrice || p.price || 0;
                const isPriceInRange = price >= 0.10 && price <= 0.90;

                if (isLarge && isNew && !isPriceInRange) {
                    console.log(`[Filter] Skipping "${p.title}" (${p.outcome}): Price $${price.toFixed(2)} outside 0.10-0.90 range.`);
                }

                return isLarge && isNew && isPriceInRange;
            });

            if (largePositions.length > 0) {
                console.log(`[Filter] Found ${largePositions.length} new high-value positions to notify!`);
                for (const pos of largePositions) {
                    const message = formatPositionMessage(pos);
                    console.log(`[Telegram] Sending alert for: ${pos.title} (${pos.outcome}) - Value: $${pos.currentValue.toFixed(2)}`);
                    await telegramBot.sendMessage(message);

                    notifiedPositions.add(pos.asset);
                    saveNotifiedPosition(notifiedPositions);

                    // Delay between messages to avoid Telegram 429 (Rate Limit)
                    await sleep(2000);
                }
            } else {
                console.log('[Filter] No new high-value positions matched criteria.');
            }
        } catch (error) {
            console.error('Error in poll loop:', error);
            consecutiveErrors++;

            if (consecutiveErrors === 3) {
                await telegramBot.sendMessage(`⚠️ <b>Warning: Connection Issues</b>\nThe bot has failed to reach Polymarket 3 times in a row (approx. 15 mins). It will keep trying, but you may want to check the server.`);
            }
        } finally {
            setTimeout(poll, config.pollIntervalMs);
        }
    };

    // Start the polling loop
    poll();
}

function toAmericanOdds(price: number): string {
    if (!price || price <= 0 || price >= 1) return 'N/A';

    // Convert probability to decimal odds
    const decimalOdds = 1 / price;

    if (decimalOdds >= 2.0) {
        const odds = Math.round((decimalOdds - 1) * 100);
        return `+${odds}`;
    } else {
        const odds = Math.round(-100 / (decimalOdds - 1));
        return `${odds}`; // Already includes minus sign
    }
}

function formatPositionMessage(pos: Position): string {
    const title = pos.title || 'Unknown Market';
    const outcome = pos.outcome || 'Unknown Outcome';
    const value = pos.currentValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    // Use averagePrice if entry price, or price if current price
    const entryPrice = pos.averagePrice || pos.price || 0;
    const americanOdds = toAmericanOdds(entryPrice);
    const priceDisplay = entryPrice > 0 ? `$${entryPrice.toFixed(2)} (${americanOdds})` : '$NaN';

    const tokens = pos.tokens.toLocaleString('en-US');

    return `🔥 <b>High-Value Position Detected!</b>\n\n` +
        `🏆 Market: <b>${title}</b>\n` +
        `🎯 Betting on: <b>${outcome}</b>\n\n` +
        `💰 Current Value: <b>${value}</b>\n` +
        `📊 Size: ${tokens} tokens\n` +
        `🏷 Entry Price: ${priceDisplay}\n\n` +
        `<i>Tracking: ${config.targetWalletAddress}</i>`;
}

main().catch(console.error);
