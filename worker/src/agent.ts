import { RestClientV5, TickerLinearInverse, PositionInfo } from 'bybit-api';
import { AgentState, Strategy, StrategyType, Position, OrderSide, Agent as AgentInfo } from './types';
import { getTradeDecision, TradeDecision } from './gemini';
import { log } from './logger';

const TRADE_CYCLE_INTERVAL_MS = 3.5 * 60 * 60 * 1000; // 3.5 hours
const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class Agent {
    public strategy: Strategy;
    private state: AgentState;
    private balance: number;
    private pnl: number;
    private tradesToday: number;
    private tradingClient: RestClientV5;

    constructor(strategy: Strategy, apiKey: string, apiSecret: string) {
        this.strategy = strategy;
        this.state = AgentState.STOPPED;
        this.balance = 0; // Will be fetched from exchange
        this.pnl = 0;
        this.tradesToday = 0;
        
        this.tradingClient = new RestClientV5({
            key: apiKey,
            secret: apiSecret,
            // Use demo trading on mainnet by setting testnet to false
            testnet: false, 
        });
    }

    public getStatus(): AgentInfo {
        return {
            id: this.strategy.id,
            name: this.strategy.name,
            type: this.strategy.type,
            state: this.state,
            balance: this.balance,
            pnl: this.pnl,
            tradesToday: this.tradesToday,
        };
    }
    
    public async getOpenPositions(): Promise<Position[]> {
        const response = await this.tradingClient.getPositionInfo({ category: 'linear' });
        return response.result.list
            .filter(p => Number(p.size) > 0)
            .map(p => ({
                symbol: p.symbol,
                side: p.side === 'Buy' ? OrderSide.LONG : OrderSide.SHORT,
                entryPrice: parseFloat(p.avgPrice),
                size: parseFloat(p.size),
                unrealizedPnl: parseFloat(p.unrealisedPnl),
                agentId: this.strategy.id,
            }));
    }

    public start() {
        if (this.state !== AgentState.STOPPED) {
            log(this.strategy.id, "Agent is already running.");
            return;
        }
        log(this.strategy.id, "Agent starting initial trading cycle.");
        this.run();
    }

    private async run() {
        try {
            this.state = AgentState.ANALYZING;
            log(this.strategy.id, "State changed to ANALYZING. Looking for a trade...");
            const decision = await this.analyze();

            if (decision) {
                this.state = AgentState.EXECUTING;
                log(this.strategy.id, "State changed to EXECUTING.");
                await this.execute(decision);
                this.tradesToday += 1;
            }

            this.state = AgentState.COOLDOWN;
            log(this.strategy.id, `Trade cycle complete. Now in cooldown for 3.5 hours.`);
            setTimeout(() => this.run(), TRADE_CYCLE_INTERVAL_MS);

        } catch (error) {
            this.state = AgentState.ERROR;
            if (error instanceof Error) {
                log(this.strategy.id, `CRITICAL ERROR in agent loop: ${error.message}`);
            } else {
                log(this.strategy.id, `CRITICAL UNKNOWN ERROR in agent loop.`);
            }
            log(this.strategy.id, `Retrying in 5 minutes.`);
            setTimeout(() => this.run(), RETRY_INTERVAL_MS);
        }
    }

    private async analyze(): Promise<TradeDecision | null> {
        // 1. Fetch all linear tickers
        const tickerResponse = await this.tradingClient.getTickers({ category: 'linear' });
        const tickers = tickerResponse.result.list;

        // 2. Filter and sort by 24h volume
        const liquidTickers = tickers
            .filter(t => parseFloat(t.turnover24h) > 50_000_000)
            .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h));
        
        // 3. Get top 20, remove top 5
        const top20 = liquidTickers.slice(0, 20);
        const final15 = top20.slice(5);
        const symbols = final15.map(t => t.symbol);
        
        if (symbols.length === 0) {
            log(this.strategy.id, 'No symbols met the liquidity criteria.');
            return null;
        }
        
        const marketContext = `Top cryptocurrencies by 24h volume (excluding the top 5): ${symbols.join(', ')}.`;
        log(this.strategy.id, `Analyzing market with ${symbols.length} symbols.`);
        
        // 4. Get decision from Gemini
        const decision = await getTradeDecision(this.strategy.prompt, marketContext);
        
        if (decision && symbols.includes(decision.symbol)) {
            log(this.strategy.id, `Gemini decision: Trade ${decision.symbol} with ${decision.confidence} confidence. Reason: ${decision.reason}`);
            return decision;
        }
        
        log(this.strategy.id, 'No valid trade decision received from Gemini.');
        return null;
    }
    
    private async execute(decision: TradeDecision) {
        const { symbol } = decision;
        const side = this.strategy.type === StrategyType.PROFIT ? 'Buy' : 'Sell';

        // 1. Set leverage
        log(this.strategy.id, `Setting leverage to 10x for ${symbol}.`);
        await this.tradingClient.setLeverage({ category: 'linear', symbol, buyLeverage: '10', sellLeverage: '10' });

        // 2. Get instrument info for order precision
        const instrumentsInfo = await this.tradingClient.getInstrumentsInfo({ category: 'linear', symbol });
        const instrument = instrumentsInfo.result.list[0];
        const qtyStep = parseFloat(instrument.lotSizeFilter.qtyStep);
        const pricePrecision = instrument.priceFilter.tickSize.split('.')[1]?.length || 0;

        // 3. Get current price
        const tickers = await this.tradingClient.getTickers({ category: 'linear', symbol });
        const markPrice = parseFloat(tickers.result.list[0].markPrice);

        // 4. Calculate order quantity for ~$100 position size
        const positionValueUSD = 100;
        const orderQtyValue = positionValueUSD / markPrice;
        
        // 5. Adjust quantity based on qtyStep
        const orderQty = String(Math.floor(orderQtyValue / qtyStep) * qtyStep);

        // 6. Calculate TP/SL prices (10% price move for a $10 PnL on a $100 position)
        const pnlPercentage = 0.10;
        const takeProfit = side === 'Buy' ? markPrice * (1 + pnlPercentage) : markPrice * (1 - pnlPercentage);
        const stopLoss = side === 'Buy' ? markPrice * (1 - pnlPercentage) : markPrice * (1 + pnlPercentage);
        
        // 7. Place the order
        log(this.strategy.id, `Submitting ${side} order for ${orderQty} ${symbol} at ~$${markPrice}. TP: ${takeProfit.toFixed(pricePrecision)}, SL: ${stopLoss.toFixed(pricePrecision)}`);
        await this.tradingClient.submitOrder({
            category: 'linear',
            symbol,
            side,
            orderType: 'Market',
            qty: orderQty,
            takeProfit: String(takeProfit.toFixed(pricePrecision)),
            stopLoss: String(stopLoss.toFixed(pricePrecision)),
        });
        log(this.strategy.id, `Order for ${symbol} placed successfully.`);
    }
}