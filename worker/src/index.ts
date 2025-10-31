import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Agent } from './agent';
import { strategies } from './strategies.config';
import { getLogs, log } from './logger';
import { getTodaysTradesAsCsv } from './tradeLogger';
import { Position } from './types';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

let agent: Agent | null = null;
let hasStarted = false;

const initializeAgent = () => {
    log('SYSTEM', 'Initializing single agent...');
    
    // Use a single strategy, the first one from the config
    const strategy = strategies[0];
    if (!strategy) {
        log('SYSTEM', 'CRITICAL: No strategy found in strategies.config.ts. Agent cannot start.');
        return;
    }

    // Load static, simple environment variable names
    const apiKey = process.env.BYBIT_API_KEY?.trim();
    const apiSecret = process.env.BYBIT_API_SECRET?.trim();

    if (!apiKey || !apiSecret) {
        log('SYSTEM', `CRITICAL: Missing BYBIT_API_KEY or BYBIT_API_SECRET environment variables. The agent will not be initialized.`);
        return;
    }

    log('SYSTEM', `Found credentials. Key length: ${apiKey.length}, Secret length: ${apiSecret.length}.`);

    agent = new Agent(strategy, apiKey, apiSecret);
    log('SYSTEM', `Agent ${strategy.id} (${strategy.name}) initialized successfully.`);
};


// API Endpoint to get status
app.get('/status', async (req, res) => {
    if (!agent) {
         return res.json({
            agents: [],
            openPositions: [],
            logs: getLogs(),
            reports: [],
        });
    }
    
    const openPosition = agent.openPosition;
    const allPositions: Position[] = openPosition ? [openPosition] : [];

    res.json({
        agents: [agent.getStatus()],
        openPositions: allPositions,
        logs: getLogs(),
        reports: [],
    });
});

// API Endpoint for live CSV report download
app.get('/reports/today.csv', (req, res) => {
    log('SYSTEM', 'Generating live trade report...');
    const csvData = getTodaysTradesAsCsv();
    res.header('Content-Type', 'text/csv');
    const fileName = `trades-${new Date().toISOString().split('T')[0]}.csv`;
    res.attachment(fileName);
    res.send(csvData);
});

// API Endpoint to start trading
app.post('/start', (req, res) => {
    if (hasStarted) {
        return res.status(400).json({ message: "Trading has already started." });
    }
    if (!agent) {
        return res.status(500).json({ message: "Agent is not initialized. Check server logs for configuration errors." });
    }

    log('SYSTEM', 'Received command to start trading.');
    hasStarted = true;
    
    (async () => {
        try {
            await agent.start();
        } catch (e) {
            console.error(`Agent failed to start:`, e instanceof Error ? e.message : String(e));
        }
    })();

    res.status(200).json({ message: "Agent is starting its trading cycle." });
});


app.listen(PORT, () => {
    console.log(`FlipEdge Worker is running on port ${PORT}`);
    if (!process.env.API_KEY) {
        console.error("WARNING: Google Gemini API_KEY is not set. AI features will fail.");
        log('SYSTEM', "WARNING: Google Gemini API_KEY is not set.");
    }
    initializeAgent();
});