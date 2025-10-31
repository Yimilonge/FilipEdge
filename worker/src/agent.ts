
import { AgentState, Strategy, StrategyType, Position, OrderSide, Agent as AgentInfo } from './types';
import { getTradeDecision, TradeDecision } from './gemini';
import { log } from './logger';

// This is a mock trading client. In a real app, this would be a client for an exchange like Bybit.
class MockTradingClient {
    constructor(private agentId: string, private apiKey: string, private apiSecret: string) {}

    async getMarketData(): Promise<string> {
        // In a real app, this would fetch live market data for relevant symbols.
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT', 'MATICUSDT'];
        log(this.agentId, "Fetching mock market data...");
        // Returning a simple list of symbols as context for Gemini.
        return `Available symbols for trading: ${symbols.join(', ')}.`;
    }

    async placeOrder(symbol: string, side: OrderSide, size: number): Promise<Position> {
        // Mock placing an order.
        log(this.agentId, `Placing MOCK ${side} order for ${size} ${symbol}`);
        const entryPrice = 3000 + Math.random() * 500; // Mock entry price
        return {
            symbol,
            side,
            entryPrice,
            size,
            unrealizedPnl: 0,
            agentId: this.agentId,
        };
    }

    async closePosition(position: Position): Promise<{ pnl: number }> {
        // Mock closing a position.
        log(this.agentId, `Closing MOCK position for ${position.symbol}`);
        // Simulate some PnL
        const pnl = (Math.random() - 0.45) * position.size * 100;
        return { pnl };
    }
    
    async updatePnl(position: Position): Promise<number> {
        // Mock updating PnL for an open position
        const pnlChange = (Math.random() - 0.5) * 5;
        position.unrealizedPnl += pnlChange;
        return position.unrealizedPnl;
    }
}


export class Agent {
    private strategy: Strategy;
    private state: AgentState;
    private balance: number;
    private pnl: number;
    private tradesToday: number;
    public openPosition: Position | null;
    private tradingClient: MockTradingClient;
    private timeoutId: NodeJS.Timeout | null = null;

    constructor(strategy: Strategy, apiKey: string, apiSecret: string) {
        this.strategy = strategy;
        this.state = AgentState.STOPPED;
        this.balance = 10000; // Starting balance
        this.pnl = 0;
        this.tradesToday = 0;
        this.openPosition = null;
        this.tradingClient = new MockTradingClient(this.strategy.id, apiKey, apiSecret);
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

    public start() {
        if (this.state !== AgentState.STOPPED) {
            log(this.strategy.id, "Agent is already running.");
            return;
        }
        log(this.strategy.id, "Agent starting trading cycle.");
        this.run();
    }
    
    public stop() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.state = AgentState.STOPPED;
        log(this.strategy.id, "Agent has been stopped.");
    }

    private async run() {
        try {
            switch (this.state) {
                case AgentState.STOPPED:
                case AgentState.COOLDOWN:
                    this.state = AgentState.ANALYZING;
                    log(this.strategy.id, "State changed to ANALYZING. Looking for a trade...");
                    await this.analyze();
                    break;
                
                case AgentState.ANALYZING:
                    // This state is handled by the analyze method, which transitions to EXECUTING or COOLDOWN.
                    // If we are here, it means analyze() was called and we wait for its completion.
                    break;
                
                case AgentState.EXECUTING:
                    // This state is handled by the execute method, which transitions to HOLDING.
                    // This case should not be hit directly in the loop.
                    break;

                case AgentState.HOLDING:
                    log(this.strategy.id, `State is HOLDING. Monitoring position in ${this.openPosition!.symbol}.`);
                    await this.hold();
                    break;
                
                case AgentState.ERROR:
                    log(this.strategy.id, "Agent is in ERROR state. Pausing for 1 minute before retry.");
                    this.scheduleNextRun(60 * 1000); // Wait 1 minute
                    this.state = AgentState.COOLDOWN; // Reset state for next run
                    break;
            }
        } catch (error) {
            this.state = AgentState.ERROR;
            if (error instanceof Error) {
                log(this.strategy.id, `CRITICAL ERROR in agent loop: ${error.message}`);
            } else {
                log(this.strategy.id, `CRITICAL UNKNOWN ERROR in agent loop.`);
            }
            this.scheduleNextRun(10 * 1000); // Retry after 10s on error
        }
    }

    private async analyze() {
        const marketContext = await this.tradingClient.getMarketData();
        const decision = await getTradeDecision(this.strategy.prompt, marketContext);

        if (decision) {
            log(this.strategy.id, `Gemini decision: Trade ${decision.symbol} with ${decision.confidence} confidence. Reason: ${decision.reason}`);
            if (decision.confidence !== 'low') {
                this.state = AgentState.EXECUTING;
                log(this.strategy.id, "State changed to EXECUTING.");
                await this.execute(decision);
            } else {
                log(this.strategy.id, "Confidence is too low, not executing. Cooling down.");
                this.state = AgentState.COOLDOWN;
                this.scheduleNextRun(30 * 1000); // 30s cooldown
            }
        } else {
            log(this.strategy.id, "No trade decision received from Gemini. Cooling down.");
            this.state = AgentState.COOLDOWN;
            this.scheduleNextRun(60 * 1000); // 1 minute cooldown
        }
    }
    
    private async execute(decision: TradeDecision) {
        try {
            // Profit-seeking agents go long, loss-seeking agents go short.
            const side = this.strategy.type === StrategyType.PROFIT ? OrderSide.LONG : OrderSide.SHORT;
            const size = (this.balance * 0.1) / 4000; // Mock size calculation: 10% of balance
            
            const position = await this.tradingClient.placeOrder(decision.symbol, side, size);
            this.openPosition = position;
            this.tradesToday += 1;
            
            this.state = AgentState.HOLDING;
            log(this.strategy.id, `Successfully opened ${side} position for ${size} ${decision.symbol}.`);
            this.scheduleNextRun(5 * 1000); // Check position status every 5 seconds
        } catch (error) {
            this.state = AgentState.ERROR;
            if (error instanceof Error) {
                log(this.strategy.id, `Error executing trade: ${error.message}`);
            } else {
                log(this.strategy.id, `Unknown error executing trade.`);
            }
            this.scheduleNextRun(10 * 1000); // Retry after 10s on error
        }
    }

    private async hold() {
        if (!this.openPosition) {
            this.state = AgentState.COOLDOWN;
            log(this.strategy.id, "No open position to hold. Cooling down.");
            this.scheduleNextRun(15 * 1000);
            return;
        }

        await this.tradingClient.updatePnl(this.openPosition);
        log(this.strategy.id, `Current PnL for ${this.openPosition.symbol}: $${this.openPosition.unrealizedPnl.toFixed(2)}`);

        // Mock logic to close position
        const shouldClose = Math.random() > 0.8; // 20% chance to close on each check

        if (shouldClose) {
            log(this.strategy.id, "Decision made to close position.");
            const result = await this.tradingClient.closePosition(this.openPosition);
            this.pnl += result.pnl;
            this.balance += result.pnl;
            this.openPosition = null;
            this.state = AgentState.COOLDOWN;
            log(this.strategy.id, `Position closed. PnL: $${result.pnl.toFixed(2)}. New balance: $${this.balance.toFixed(2)}. Cooling down.`);
            this.scheduleNextRun(2 * 60 * 1000); // 2 minute cooldown after trade
        } else {
            // Continue holding, check again in 5 seconds
            this.scheduleNextRun(5 * 1000);
        }
    }

    private scheduleNextRun(delay: number) {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.timeoutId = setTimeout(() => this.run(), delay);
    }
}
