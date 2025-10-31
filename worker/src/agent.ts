
import { AgentState, Strategy, StrategyType, Position, OrderSide, Agent as AgentInfo } from './types';
import { getTradeDecision, getHoldDecision, TradeDecision } from './gemini';
import { log } from './logger';
import { BybitClient } from './bybitClient';
import { logTrade } from './tradeLogger';

const MAX_HOLD_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export class Agent {
    private strategy: Strategy;
    private state: AgentState;
    private balance: number;
    private pnl: number;
    private tradesToday: number;
    public openPosition: Position | null;
    private tradingClient: BybitClient;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;

    constructor(strategy: Strategy, apiKey: string, apiSecret: string) {
        this.strategy = strategy;
        this.state = AgentState.STOPPED;
        this.balance = 10000; // Starting balance
        this.pnl = 0;
        this.tradesToday = 0;
        this.openPosition = null;
        this.tradingClient = new BybitClient(this.strategy.id, apiKey, apiSecret);
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
                
                case AgentState.HOLDING:
                    log(this.strategy.id, `State is HOLDING. Monitoring position in ${this.openPosition!.symbol}.`);
                    await this.hold();
                    break;
                
                case AgentState.ERROR:
                    log(this.strategy.id, "Agent is in ERROR state. Pausing for 1 minute before retry.");
                    this.state = AgentState.COOLDOWN;
                    this.scheduleNextRun(60 * 1000);
                    break;

                // Other states are transitional, so we just wait for the scheduled run.
                case AgentState.ANALYZING:
                case AgentState.EXECUTING:
                    break;
            }
        } catch (error) {
            this.state = AgentState.ERROR;
            const errorMessage = error instanceof Error ? error.message : 'CRITICAL UNKNOWN ERROR';
            log(this.strategy.id, `CRITICAL ERROR in agent loop: ${errorMessage}`);
            this.scheduleNextRun(10 * 1000);
        }
    }

    private async analyze() {
        const marketContext = await this.tradingClient.getMarketData();
        const decision = await getTradeDecision(this.strategy.prompt, marketContext);

        if (decision && decision.confidence !== 'low') {
            log(this.strategy.id, `Gemini decision: Trade ${decision.symbol} with ${decision.confidence} confidence. Reason: ${decision.reason}`);
            this.state = AgentState.EXECUTING;
            log(this.strategy.id, "State changed to EXECUTING.");
            await this.execute(decision);
        } else {
            const reason = decision ? "Confidence is too low" : "No trade decision received";
            log(this.strategy.id, `${reason} from Gemini. Cooling down.`);
            this.state = AgentState.COOLDOWN;
            this.scheduleNextRun(60 * 1000); // 1 minute cooldown
        }
    }
    
    private async execute(decision: TradeDecision) {
        try {
            // Set 10x leverage for the selected symbol before trading
            await this.tradingClient.setLeverage(decision.symbol, '10');

            const instrument = await this.tradingClient.getInstrumentInfo(decision.symbol);
            const ticker = await this.tradingClient.getTicker(decision.symbol);
            const price = parseFloat(ticker.lastPrice);
            const minOrderSize = parseFloat(instrument.lotSizeFilter.minOrderQty);
            const qtyStep = parseFloat(instrument.lotSizeFilter.qtyStep);
            const tickSize = parseFloat(instrument.priceFilter.tickSize);

            // Calculate TP/SL prices (10% movement for a $10 PnL on a $100 position)
            const riskPercentage = 0.10; 
            let takeProfitPrice: number;
            let stopLossPrice: number;
            const side = this.strategy.type === StrategyType.PROFIT ? OrderSide.LONG : OrderSide.SHORT;

            if (side === OrderSide.LONG) {
                stopLossPrice = price * (1 - riskPercentage);
                takeProfitPrice = price * (1 + riskPercentage);
            } else { // SHORT
                stopLossPrice = price * (1 + riskPercentage);
                takeProfitPrice = price * (1 - riskPercentage);
            }
            
            // Format prices to the correct tick size
            const formatPrice = (p: number) => {
                const precision = tickSize.toString().includes('.') ? tickSize.toString().split('.')[1].length : 0;
                return p.toFixed(precision);
            };

            const takeProfitString = formatPrice(takeProfitPrice);
            const stopLossString = formatPrice(stopLossPrice);

            // Calculate order size for a ~$100 position ($10 margin at 10x leverage)
            const sizeInUsd = 100;
            let qty = sizeInUsd / price;

            // Adjust quantity to meet exchange rules
            if (qty < minOrderSize) {
                log(this.strategy.id, `Calculated quantity ${qty} is below minimum ${minOrderSize}. Aborting trade.`);
                this.state = AgentState.COOLDOWN;
                this.scheduleNextRun(30 * 1000);
                return;
            }

            // Adjust to qtyStep (precision)
            qty = Math.floor(qty / qtyStep) * qtyStep;
            const finalQtyString = qty.toFixed(qtyStep.toString().includes('.') ? qtyStep.toString().split('.')[1].length : 0);

            await this.tradingClient.placeOrder(decision.symbol, side, finalQtyString, takeProfitString, stopLossString);
            
            // Wait a moment for the position to register on the exchange
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const bybitPosition = await this.tradingClient.getPosition(decision.symbol);
            if (!bybitPosition) {
                throw new Error("Position not found on exchange after placing order.");
            }
            
            this.openPosition = {
                symbol: bybitPosition.symbol,
                side: bybitPosition.side === 'Buy' ? OrderSide.LONG : OrderSide.SHORT,
                entryPrice: parseFloat(bybitPosition.avgPrice),
                size: parseFloat(bybitPosition.size),
                unrealizedPnl: parseFloat(bybitPosition.unrealisedPnl),
                agentId: this.strategy.id,
                entryTimestamp: Date.now(),
            };
            
            this.tradesToday += 1;
            this.state = AgentState.HOLDING;
            log(this.strategy.id, `Successfully opened ${side} position for ${finalQtyString} ${decision.symbol} with TP ${takeProfitString} and SL ${stopLossString}.`);
            this.scheduleNextRun(15 * 1000); // Check position status every 15 seconds
        } catch (error) {
            this.state = AgentState.ERROR;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log(this.strategy.id, `Error executing trade: ${errorMessage}`);
            this.scheduleNextRun(10 * 1000);
        }
    }

    private async hold() {
        if (!this.openPosition) {
            this.state = AgentState.COOLDOWN;
            log(this.strategy.id, "No open position to hold. Cooling down.");
            this.scheduleNextRun(15 * 1000);
            return;
        }

        const bybitPosition = await this.tradingClient.getPosition(this.openPosition.symbol);
        if (!bybitPosition) {
            log(this.strategy.id, `Position for ${this.openPosition.symbol} no longer open. Assuming it was closed by TP/SL or manually.`);
            await this.recordClosedPosition();
            return;
        }

        this.openPosition.unrealizedPnl = parseFloat(bybitPosition.unrealisedPnl);
        log(this.strategy.id, `Current PnL for ${this.openPosition.symbol}: $${this.openPosition.unrealizedPnl.toFixed(2)}`);
        
        const heldDuration = Date.now() - this.openPosition.entryTimestamp;
        if (heldDuration > MAX_HOLD_DURATION) {
            log(this.strategy.id, "Max hold duration reached. Forcing position closure.");
            await this.closePosition("Max hold duration reached");
            return;
        }

        const marketContext = await this.tradingClient.getMarketData();
        const decision = await getHoldDecision(this.strategy.prompt, this.openPosition, marketContext);

        if (decision === 'CLOSE') {
            await this.closePosition("AI decision");
        } else {
            log(this.strategy.id, "AI decision is to HOLD. Checking again in 1 minute.");
            this.scheduleNextRun(60 * 1000);
        }
    }
    
    private async recordClosedPosition() {
        if (!this.openPosition) return;
        
        const originalPosition = { ...this.openPosition };
        this.openPosition = null; // Clear position immediately to prevent race conditions
        
        try {
            const closedPnlData = await this.tradingClient.getClosedPnl(originalPosition.symbol);
            
            if (!closedPnlData) {
                log(this.strategy.id, `Could not find closed PnL data for ${originalPosition.symbol}. PnL will not be recorded for this trade.`);
            } else {
                const finalPnl = parseFloat(closedPnlData.closedPnl);
                const closePrice = parseFloat(closedPnlData.avgExitPrice);
                
                this.pnl += finalPnl;
                this.balance += finalPnl;

                logTrade({
                    timestamp: new Date(parseInt(closedPnlData.updatedTime)).toISOString(),
                    agentId: this.strategy.id,
                    symbol: originalPosition.symbol,
                    side: originalPosition.side,
                    size: originalPosition.size,
                    entryPrice: originalPosition.entryPrice,
                    closePrice: closePrice,
                    pnl: finalPnl,
                });
                
                log(this.strategy.id, `Position recorded. Realized PnL: $${finalPnl.toFixed(2)}. New balance: $${this.balance.toFixed(2)}.`);
            }

            this.state = AgentState.COOLDOWN;
            log(this.strategy.id, `Cooling down for 2 minutes.`);
            this.scheduleNextRun(2 * 60 * 1000);

        } catch(error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log(this.strategy.id, `Error recording closed position: ${errorMessage}`);
            this.state = AgentState.ERROR;
            this.scheduleNextRun(10 * 1000);
        }
    }


    private async closePosition(reason: string) {
        if (!this.openPosition) return;

        log(this.strategy.id, `Closing position for ${this.openPosition.symbol}. Reason: ${reason}`);
        
        try {
            await this.tradingClient.closePosition(this.openPosition.symbol, this.openPosition.side, this.openPosition.size.toString());
            log(this.strategy.id, `Close order sent for ${this.openPosition.symbol}. Will confirm closure shortly.`);
            this.scheduleNextRun(5 * 1000); // Check again quickly to record the closed trade
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log(this.strategy.id, `Error sending close order for ${this.openPosition.symbol}: ${errorMessage}`);
            this.state = AgentState.ERROR;
            this.scheduleNextRun(10 * 1000);
        }
    }

    private scheduleNextRun(delay: number) {
        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => this.run(), delay);
    }
}
