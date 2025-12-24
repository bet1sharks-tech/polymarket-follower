import { config } from './config';
import { PolymarketClient, Position } from './polymarket';
import { TelegramNotifier } from './telegram';

async function main() {
    console.log('Starting Polymarket Follower (Position Monitor)...');
    console.log(`Tracking Wallet: ${config.targetWalletAddress}`);
    console.log(`Poll Interval: ${config.pollIntervalMs}ms`);

    const polyClient = new PolymarketClient(config.targetWalletAddress);
    const telegramBot = new TelegramNotifier(config.telegramBotToken, config.telegramChatId);

    // Maintain a set of conditionIds that have already hit the $5000 threshold
    // and been notified about, to avoid duplicate alerts.
    const notifiedPositions = new Set<string>();

    const poll = async () => {
        try {
            console.log(`[${new Date().toISOString()}] Polling positions...`);
            const positions = await polyClient.fetchPositions();

            // Filter for positions where value > $5000 and we haven't notified yet
            const largePositions = positions.filter(p => {
                const isLarge = p.currentValue >= 5000;
                const isNew = !notifiedPositions.has(p.conditionId);
                return isLarge && isNew;
            });

            if (largePositions.length > 0) {
                console.log(`Found ${largePositions.length} new high-value positions!`);
                for (const pos of largePositions) {
                    const message = formatPositionMessage(pos);
                    await telegramBot.sendMessage(message);
                    notifiedPositions.add(pos.conditionId);
                }
            } else {
                console.log('No new high-value positions.');
            }
        } catch (error) {
            console.error('Error in poll loop:', error);
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
