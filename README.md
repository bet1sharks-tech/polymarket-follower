# Polymarket High-Value Position Follower

A TypeScript-based Telegram bot that monitors specific Polymarket wallets for high-value trading positions and sends real-time alerts with American odds formatting.

## 🚀 Features

- **High-Value Monitoring**: Filters for positions with a current value of **$5,000+**.
- **American Odds Conversion**: Automatically converts Polymarket decimal probabilities to standard American odds (e.g., -110, +150).
- **Smart Filtering**: Ignores markets with prices > 0.90 or < 0.10 to filter out resolved or near-resolution events.
- **Persistence**: Remembers already notified positions in a local database (`.data/notified_positions.json`) to prevent duplicate alerts on restart.
- **Health Monitoring**:
  - **Daily Heartbeat**: Confirms the bot is online once every 24 hours.
  - **Error Alerts**: Notifies you if the bot fails to connect/poll 3 times in a row (approx. 15 minutes of downtime).
- **Rate Limited**: Implements a 2-second delay between Telegram messages to avoid API rate limiting.

## 🛠 Setup

### 1. Prerequisites
- Node.js (v16+)
- A Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Your Telegram Chat ID (or group ID)

### 2. Installation
```bash
# Clone the repository
# (Assuming you've pushed this to your repo)
git clone <your-repo-url>
cd polymarket-follower

# Install dependencies
npm install
```

### 3. Configuration
Create a `.env` file in the root directory:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
TARGET_WALLET_ADDRESS=polymarket_wallet_to_track
POLL_INTERVAL_MS=300000  # Default 5 minutes
```

## 📈 Running the Bot

### Development Mode (Auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

## 📁 Project Structure
- `src/index.ts`: Main polling loop and filtering logic.
- `src/polymarket.ts`: API client for Polymarket data.
- `src/telegram.ts`: Telegram notification wrapper.
- `src/config.ts`: Environment variable management.
- `.data/`: Persistent storage for notified alerts.

## ⚖️ License
MIT
