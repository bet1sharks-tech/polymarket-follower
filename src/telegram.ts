import TelegramBot from 'node-telegram-bot-api';

export class TelegramNotifier {
    private bot: TelegramBot;
    private chatId: string;

    constructor(token: string, chatId: string) {
        // polling: false because we only want to send messages, not receive them continuously
        this.bot = new TelegramBot(token, { polling: false });
        this.chatId = chatId;
    }

    async sendMessage(message: string): Promise<void> {
        try {
            await this.bot.sendMessage(this.chatId, message, { parse_mode: 'HTML' });
            console.log('Notification sent to Telegram.');
        } catch (error) {
            console.error('Failed to send Telegram notification:', error);
        }
    }
}
