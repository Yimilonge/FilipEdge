
import { V5Client } from 'bybit-api';
import { AgentState, Strategy, OrderSide, Position } from './types';
import { getTradingDecision } from './gemini';
import { log } from './logger';

const TRADE_INTERVAL_HOURS = 3.5;
const LEVERAGE = "10";
const POSITION_VALUE_USD = 10; // $10 margin * 10x leverage = $100 position

export class Agent {
    public id: string;
    public name: string;
    public state: AgentState = AgentState.STOPPED;
    public balance: number = 0;
    public pnl: number = 0;
    public tradesToday: number = 0;
    public openPosition: Position | null = null;
    
    private bybitClient: V5Client;
    private strategy: Strategy;
    // Fix: Use ReturnType<typeof setInterval> to avoid NodeJS namespace error.
    private tradeInterval: ReturnType<typeof setInterval> | null = null;

    constructor(strategy: Strategy, apiKey: string, apiSecret: string) {
        this.id = strategy.id;
        this.name = strategy.name;
        this.strategy = strategy;

        this.bybitClient = new V5Client({
            key: apiKey,
            secret: apiSecret,
            testnet: true, // Using testnet for demo trading
            demo: true,
        });
    }

    public getStatus() {
        return {
            id: this.id,
            name: this.name,
            type: this.strategy.type,
            state: this.state,
            balance: this.balance,
            pnl: this.pnl,
            tradesToday: this.tradesToday,
        };
    }

    public async start() {
        log(this.id, 'Agent starting...');
        await this.updateAccountState();
        this.scheduleNextTrade();
        this.state = AgentState.COOLDOWN; // Start in cooldown until first trade
    }

    private scheduleNextTrade() {
        const intervalMs = TRADE_INTERVAL_HOURS * 60 * 60 * 1000;
        if (this.tradeInterval) {
            clearInterval(this.tradeInterval);
        }
        this.tradeInterval = setInterval(() => this.runTradingCycle(), intervalMs);
        log(this.id, `Next trade scheduled in ${TRADE_INTERVAL_HOURS} hours.`);
        // For immediate execution on start
        this.runTradingCycle(); 
    }
    
    private async updateAccountState() {
        try {
            // Update balance
            const wallet = await this.bybitClient.getWalletBalance({ accountType: 'UNIFIED' });
            this.balance = parseFloat(wallet.result.list[0].totalEquity);

            // Update open position and PnL
            const positions = await this.bybitClient.getPositionInfo({ category: 'linear', settleCoin: 'USDT' });
            const openPositions = positions.result.list.filter(p => parseFloat(p.size) > 0);

            if (openPositions.length > 0) {
                const pos = openPositions[0];
                this.state = AgentState.HOLDING;
                this.openPosition = {
                    agentId: this.id,
                    symbol: pos.symbol,
                    side: pos.side === 'Buy' ? OrderSide.LONG : OrderSide.SHORT,
                    entryPrice: parseFloat(pos.avgPrice),
                    size: parseFloat(pos.size),
                    unrealizedPnl: parseFloat(pos.unrealisedPnl),
                };
                 this.pnl = parseFloat(pos.unrealisedPnl); // Simplified PnL for demo
            } else {
                this.openPosition = null;
                // If not holding, check if we were recently in a trade
                if (this.state !== AgentState.ANALYZING && this.state !== AgentState.EXECUTING) {
                   this.state = AgentState.COOLDOWN;
                }
            }
        } catch (error) {
            log(this.id, `Error updating account state: ${error}`);
            this.state = AgentState.ERROR;
        }
    }

    private async runTradingCycle() {
        log(this.id, "Starting new trading cycle.");
        await this.updateAccountState();

        if (this.openPosition) {
            log(this.id, `Skipping cycle, already in position for ${this.openPosition.symbol}.`);
            return;
        }
        
        try {
            this.state = AgentState.ANALYZING;
            
            // 1. Get tickers and filter
            const tickers = await this.bybitClient.getTickers({ category: 'linear' });
            const liquidTickers = tickers.result.list
                .filter(t => t.symbol.endsWith('USDT') && parseFloat(t.turnover24h) > 50_000_000)
                .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h));

            if (liquidTickers.length < 20) {
                throw new Error("Not enough liquid tickers to analyze.");
            }
            
            const symbolsToAnalyze = liquidTickers.slice(5, 20).map(t => t.symbol);
            log(this.id, `Analyzing ${symbolsToAnalyze.length} symbols...`);

            // 2. Get decision from Gemini
            const decision = await getTradingDecision(this.strategy.prompt, symbolsToAnalyze);
            if (!decision) {
                throw new Error("Failed to get a valid trading decision from AI.");
            }
            log(this.id, `AI decision: ${decision.side} ${decision.symbol}. Reasoning: ${decision.reasoning}`);

            // 3. Execute trade
            this.state = AgentState.EXECUTING;
            await this.executeTrade(decision.symbol, decision.side as 'Buy' | 'Sell');
            
            this.tradesToday += 1;
            await this.updateAccountState();

        } catch (error) {
            log(this.id, `Trading cycle failed: ${error}`);
            this.state = AgentState.ERROR;
        }
    }
    
    private async executeTrade(symbol: string, side: 'Buy' | 'Sell') {
        try {
            log(this.id, `Executing ${side} order for ${symbol}`);
            // Ensure leverage is set
            await this.bybitClient.setLeverage({ category: 'linear', symbol, buyLeverage: LEVERAGE, sellLeverage: LEVERAGE });
            log(this.id, `Leverage set to ${LEVERAGE}x for ${symbol}.`);

            // Get instrument info for order size calculation
            const instruments = await this.bybitClient.getInstrumentsInfo({ category: 'linear', symbol });
            const instrument = instruments.result.list[0];
            const priceFilter = instrument.priceFilter;
            const lotSizeFilter = instrument.lotSizeFilter;
            
            const lastPrice = parseFloat((await this.bybitClient.getTickers({ category: 'linear', symbol })).result.list[0].lastPrice);

            // Calculate order size
            const qty = POSITION_VALUE_USD / lastPrice;
            const stepSize = parseFloat(lotSizeFilter.qtyStep);
            const orderQty = (Math.floor(qty / stepSize) * stepSize).toString();

            if (parseFloat(orderQty) < parseFloat(lotSizeFilter.minOrderQty)) {
                throw new Error(`Calculated order quantity ${orderQty} is below minimum ${lotSizeFilter.minOrderQty}`);
            }
            
            // Calculate TP/SL (10% price move for 100% PnL on 10x leverage)
            const priceMove = lastPrice * 0.10;
            const tickSize = parseFloat(priceFilter.tickSize);

            const calculatePrice = (base: number, move: number, direction: number) => {
                const rawPrice = base + move * direction;
                return (Math.round(rawPrice / tickSize) * tickSize).toFixed(5);
            }

            const takeProfit = side === 'Buy' ? calculatePrice(lastPrice, priceMove, 1) : calculatePrice(lastPrice, priceMove, -1);
            const stopLoss = side === 'Buy' ? calculatePrice(lastPrice, priceMove, -1) : calculatePrice(lastPrice, priceMove, 1);
            
            log(this.id, `Order details: Qty=${orderQty}, Price=${lastPrice}, TP=${takeProfit}, SL=${stopLoss}`);
            
            // Place order
            const order = await this.bybitClient.submitOrder({
                category: 'linear',
                symbol,
                side,
                orderType: 'Market',
                qty: orderQty,
                takeProfit,
                stopLoss,
            });
            
            log(this.id, `Order submitted successfully. Order ID: ${order.result.orderId}`);
            this.state = AgentState.HOLDING;

        } catch (error: any) {
            const errorMessage = error.response?.data?.retMsg || error.message;
            log(this.id, `Order execution failed: ${errorMessage}`);
            this.state = AgentState.ERROR;
            throw new Error(`Order execution failed: ${errorMessage}`);
        }
    }
}