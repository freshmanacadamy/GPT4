const TelegramBot = require('node-telegram-bot-api');
const { BOT_TOKEN } = require('./environment');

class BotSingleton {
    constructor() {
        if (!BOT_TOKEN) {
            throw new Error('❌ BOT_TOKEN environment variable is required');
        }
        this.bot = new TelegramBot(BOT_TOKEN);
    }

    getBot() {
        return this.bot;
    }
}

// Create single instance
const botInstance = new BotSingleton();
module.exports = botInstance;
