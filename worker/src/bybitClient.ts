
import { RestClientV5 } from 'bybit-api';
import { log } from './logger';
import { OrderSide } from './types';

const HIGH_VOLUME_THRESHOLD = 50000000; // 50 Million USD

export class BybitClient {
    private client: RestClientV5;

    constructor(private agentId: string, apiKey: string, apiSecret: string) {
        this.client = new RestClientV5({
            key: apiKey,
            secret: apiSecret,
            // Use the testnet for safe testing
            testnet: true, 
        });
    }

    async getMarketData(): Promise<string> {
        log(this.agentId, "Fetching market data from Bybit...");
        try {
            const response = await this.client.getTickers({ category: 'linear' });
            if (response.retCode !== 0) {
                throw new Error(`Bybit API error: ${response.retMsg}`);
            }

            const highVolumeTickers = response.result.list
                .filter(ticker => ticker.symbol.endsWith('USDT') && parseFloat(ticker.turnover24h) > HIGH_VOLUME_THRESHOLD)
                .slice(0, 20); // Limit to top 20 for brevity

            const marketContext = highVolumeTickers.map(t => 
                `${t.symbol}, Price: ${t.lastPrice}, 24h Change: ${(parseFloat(t.price24hPcnt) * 100).toFixed(2)}%, Volume: ${parseFloat(t.volume24h).toFixed(0)}`
            ).join('\n');
            
            return marketContext;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            log(this.agentId, `Failed to fetch market data: ${errorMessage}`);
            throw error;
        }
    }
    
    async getInstrumentInfo(symbol: string) {
        log(this.agentId, `Fetching instrument info for ${symbol}...`);
        try {
            const response = await this.client.getInstrumentsInfo({ category: 'linear', symbol });
            if (response.retCode !== 0 || !response.result.list.length) {
                throw new Error(`Failed to get instrument info for ${symbol}: ${response.retMsg}`);
            }
            return response.result.list[0];
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            log(this.agentId, `Error fetching instrument info: ${errorMessage}`);
            throw error;
        }
    }

    async setLeverage(symbol: string, leverage: string) {
        log(this.agentId, `Setting leverage for ${symbol} to ${leverage}x...`);
        try {
            const response = await this.client.setLeverage({
                category: 'linear',
                symbol,
                buyLeverage: leverage,
                sellLeverage: leverage,
            });
            if (response.retCode !== 0) {
                // Bybit returns success even if leverage is already set, so we can ignore specific messages
                if (response.retMsg.includes('leverage not modified')) {
                    log(this.agentId, `Leverage for ${symbol} is already ${leverage}x.`);
                    return;
                }
                throw new Error(`Failed to set leverage: ${response.retMsg}`);
            }
            log(this.agentId, `Leverage for ${symbol} set to ${leverage}x successfully.`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            log(this.agentId, `Error setting leverage: ${errorMessage}`);
            throw error;
        }
    }

    async placeOrder(symbol: string, side: OrderSide, qty: string, takeProfit?: string, stopLoss?: string) {
        const orderRequest = {
            category: 'linear' as const,
            symbol,
            side: (side === OrderSide.LONG ? 'Buy' : 'Sell') as 'Buy' | 'Sell',
            orderType: 'Market' as const,
            qty,
            takeProfit,
            stopLoss,
        };
        log(this.agentId, `Placing order: ${JSON.stringify(orderRequest)}`);
        try {
            const response = await this.client.submitOrder(orderRequest);
            if (response.retCode !== 0) {
                throw new Error(`Failed to place order: ${response.retMsg}`);
            }
            log(this.agentId, `Order placed successfully. Order ID: ${response.result.orderId}`);
            return response.result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            log(this.agentId, `Error placing order: ${errorMessage}`);
            throw error;
        }
    }
    
    async getPosition(symbol: string) {
        log(this.agentId, `Fetching position for ${symbol}...`);
        try {
            const response = await this.client.getPositionInfo({ category: 'linear', symbol });
             if (response.retCode !== 0) {
                throw new Error(`Failed to get position: ${response.retMsg}`);
            }
            // A position exists if size is greater than 0
            const position = response.result.list.find(p => parseFloat(p.size) > 0);
            return position || null;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            log(this.agentId, `Error fetching position: ${errorMessage}`);
            throw error;
        }
    }
    
    async closePosition(symbol: string, side: OrderSide, size: string) {
        log(this.agentId, `Closing ${side} position of size ${size} for ${symbol}...`);
        try {
            const response = await this.client.submitOrder({
                category: 'linear',
                symbol: symbol,
                side: side === OrderSide.LONG ? 'Sell' : 'Buy', // Opposite side to close
                orderType: 'Market',
                qty: size,
                reduceOnly: true,
            });
            if (response.retCode !== 0) {
                throw new Error(`Failed to close position: ${response.retMsg}`);
            }
            log(this.agentId, `Position close order sent. Order ID: ${response.result.orderId}`);
            return response.result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            log(this.agentId, `Error closing position: ${errorMessage}`);
            throw error;
        }
    }
    
    async getClosedPnl(symbol: string) {
        log(this.agentId, `Fetching last closed PnL for ${symbol}...`);
        try {
            const response = await this.client.getClosedPnL({ category: 'linear', symbol, limit: 1 });
            if (response.retCode !== 0) {
                throw new Error(`Failed to get closed PnL: ${response.retMsg}`);
            }
            if (response.result.list.length > 0) {
                return response.result.list[0];
            }
            return null;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            log(this.agentId, `Error fetching closed PnL: ${errorMessage}`);
            throw error;
        }
    }
}
