import axios from 'axios';

interface Activity {
    id: string;
    type: string;
    timestamp: number;
    marketSlug?: string;
    title?: string;
    outcome?: string;
    asset?: string;
    side?: string;
    size?: number;
    price?: number;
}

export interface Position {
    conditionId: string;
    asset: string;
    title: string;
    outcome: string;
    currentValue: number;
    tokens: number;
    price: number;
    averagePrice: number;
    initialValue: number;
}

export class PolymarketClient {
    private userAddress: string;
    private lastCheckedTimestamp: number;

    constructor(userAddress: string) {
        this.userAddress = userAddress;
        // Initialize last checked as current time to avoid spamming old notifications on startup
        // Or set to 0 if you want to see the last few actions immediately for testing
        this.lastCheckedTimestamp = Math.floor(Date.now() / 1000);
    }

    async fetchNewActivity(): Promise<any[]> {
        try {
            const url = `https://data-api.polymarket.com/activity?user=${this.userAddress}&limit=10`;
            const response = await axios.get(url);

            if (!response.data || !Array.isArray(response.data)) {
                console.warn('Unexpected API response structure:', response.data);
                return [];
            }

            const activities = response.data;

            // Filter for activities newer than last check
            const newActivities = activities.filter((activity: any) => {
                return activity.timestamp > this.lastCheckedTimestamp;
            });

            if (newActivities.length > 0) {
                // Update last checked to the most recent activity
                // Assumes API returns sorted data, but let's be safe and find the max
                const maxTimestamp = Math.max(...newActivities.map((a: any) => a.timestamp));
                this.lastCheckedTimestamp = maxTimestamp;
            }

            return newActivities;

        } catch (error) {
            console.error('Error fetching Polymarket activity:', error);
            return [];
        }
    }

    // Fetches current portfolio positions
    async fetchPositions(): Promise<Position[]> {
        try {
            const url = `https://data-api.polymarket.com/positions?user=${this.userAddress}&limit=500`;
            const response = await axios.get(url);

            if (!response.data || !Array.isArray(response.data)) {
                return [];
            }

            return response.data.map((p: any) => ({
                conditionId: p.conditionId,
                asset: p.asset,
                title: p.title,
                outcome: p.outcome,
                currentValue: parseFloat(p.currentValue || '0'),
                tokens: parseFloat(p.size || p.tokens || '0'),
                price: parseFloat(p.price || p.curPrice || '0'),
                averagePrice: parseFloat(p.avgPrice || p.averagePrice || '0'),
                initialValue: parseFloat(p.initialValue || '0'),
            }));

        } catch (error) {
            console.error('Error fetching Polymarket positions:', error);
            return [];
        }
    }

    // Temporary method to fetch recent activity regardless of timestamp (for testing)
    async fetchRecentActivityForTesting(): Promise<any[]> {
        try {
            const url = `https://data-api.polymarket.com/activity?user=${this.userAddress}&limit=5`;
            const response = await axios.get(url);
            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            console.error('Error fetching testing activity:', error);
            return [];
        }
    }
}
