import { config } from './config';
import { PolymarketClient } from './polymarket';
import { TelegramNotifier } from './telegram';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log('Starting Polymarket Follower (Activity Monitor)...');
    console.log(`Tracking Wallet: ${config.targetWalletAddress}`);
    console.log(`Poll Interval: ${config.pollIntervalMs}ms`);

    const polyClient = new PolymarketClient(config.targetWalletAddress);
    const telegramBot = new TelegramNotifier(config.telegramBotToken, config.telegramChatId);

    // Startup Message
    await telegramBot.sendMessage(`🟢 <b>Bot Started</b>\nI am running at the moment and monitoring wallet: <code>${config.targetWalletAddress}</code>`);

    let consecutiveErrors = 0;
    let lastHeartbeat = Date.now();
    const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    // Handle Shutdown/Crash
    const handleExit = async (reason: string) => {
        console.log(`[Exit] ${reason}`);
        try {
            await telegramBot.sendMessage(`🔴 <b>Bot Stopped</b>\nWarning: The bot has stopped working. Reason: <code>${reason}</code>`);
        } catch (err) {
            console.error('Failed to send exit message:', err);
        }
        process.exit(reason === 'Crash' ? 1 : 0);
    };

    process.on('SIGINT', () => handleExit('Terminated (User)'));
    process.on('SIGTERM', () => handleExit('Terminated (System)'));
    process.on('uncaughtException', (err) => {
        console.error('Uncaught Exception:', err);
        handleExit('Crash (Uncaught Exception)');
    });
    process.on('unhandledRejection', (reason) => {
        console.error('Unhandled Rejection:', reason);
        handleExit('Crash (Unhandled Rejection)');
    });

    const poll = async () => {
        try {
            console.log(`[${new Date().toISOString()}] Checking for new activities...`);

            // Check for Daily Heartbeat
            if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
                await telegramBot.sendMessage(`💚 <b>Bot Heartbeat</b>\nThe bot is online and actively monitoring wallet: <code>${config.targetWalletAddress}</code>`);
                lastHeartbeat = Date.now();
            }

            const activities = await polyClient.fetchNewActivity();

            // Success! Reset consecutive errors
            consecutiveErrors = 0;

            // Filter for activities:
            // 1. Type is BUY
            // 2. Value (size * price) > $1000
            const buyActivities = activities.filter((a: any) => {
                const isBuy = a.side?.toUpperCase() === 'BUY';
                const value = (a.size || 0) * (a.price || 0);
                const isHighValue = value >= 1000;

                if (isBuy && !isHighValue) {
                    console.log(`[Filter] Skipping small BUY: ${a.title} - Value: $${value.toFixed(2)}`);
                }

                return isBuy && isHighValue;
            });

            if (buyActivities.length > 0) {
                console.log(`[Filter] Found ${buyActivities.length} new high-value BUY activities!`);
                for (const activity of buyActivities) {
                    const message = formatActivityMessage(activity);
                    console.log(`[Telegram] Sending alert for BUY: ${activity.title} - Value: $${((activity.size || 0) * (activity.price || 0)).toFixed(2)}`);
                    await telegramBot.sendMessage(message);

                    // Delay between messages to avoid Telegram 429
                    await sleep(2000);
                }
            }
        } catch (error) {
            console.error('Error in poll loop:', error);
            consecutiveErrors++;

            if (consecutiveErrors === 3) {
                await telegramBot.sendMessage(`⚠️ <b>Warning: Connection Issues</b>\nThe bot has failed to reach Polymarket 3 times in a row. It will keep trying.`);
            }
        } finally {
            setTimeout(poll, config.pollIntervalMs);
        }
    };

    // Start the polling loop
    poll();
}

function formatActivityMessage(activity: any): string {
    const title = activity.title || 'Unknown Market';
    const outcome = activity.outcome || 'Unknown Outcome';
    const size = activity.size || 0;
    const price = activity.price || 0;
    const value = (size * price).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const americanOdds = toAmericanOdds(price);

    return `🚀 <b>New High-Value BUY Detected!</b>\n\n` +
        `🏆 Market: <b>${title}</b>\n` +
        `🎯 Side: <b>${outcome}</b>\n\n` +
        `💰 Total Value: <b>${value}</b>\n` +
        `📊 Size: ${size.toLocaleString()} tokens\n` +
        `🏷 Price: $${price.toFixed(2)} (${americanOdds})\n\n` +
        `<i>Wallet Activity: ${config.targetWalletAddress}</i>`;
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

main().catch(console.error);
