import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Agent } from './agent';
import { strategies } from './strategies.config';
import { getLogs, log } from './logger';
import { getTodaysTradesAsCsv } from './tradeLogger';
import { Position } from './types';
import { BybitClient } from './bybitClient';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

let agents: Agent[] = [];
let hasStarted = false;

const initializeAgents = () => {
    log('SYSTEM', 'Initializing agents...');
    const initializedAgents: Agent[] = [];

    for (const strategy of strategies) {
        // Trim whitespace from keys which can cause authentication errors
        const apiKey = process.env[`BYBIT_API_KEY_${strategy.id}`]?.trim();
        const apiSecret = process.env[`BYBIT_API_SECRET_${strategy.id}`]?.trim();

        if (!apiKey || !apiSecret) {
            log('SYSTEM', `CRITICAL: Missing API Key or Secret for agent ${strategy.id}. This agent will not be initialized.`);
            continue; // Skip initializing this agent
        }

        // Add diagnostic logging to help verify environment variable loading
        log('SYSTEM', `Found credentials for agent ${strategy.id}. Key length: ${apiKey.length}, Secret length: ${apiSecret.length}.`);

        initializedAgents.push(new Agent(strategy, apiKey, apiSecret));
        log('SYSTEM', `Agent ${strategy.id} (${strategy.name}) initialized.`);
    }
    
    agents = initializedAgents;

    if (agents.length === 0) {
        log('SYSTEM', 'CRITICAL: No agents were initialized. Please check your environment variables for BYBIT_API_KEY_ and BYBIT_API_SECRET_ for each agent (e.g., BYBIT_API_KEY_P1).');
    } else {
        log('SYSTEM', `Initialization complete. ${agents.length} out of ${strategies.length} agents are ready.`);
    }
};


// API Endpoint to get status
app.get('/status', async (req, res) => {
    if (agents.length === 0 && strategies.length > 0) {
         return res.json({
            agents: [],
            openPositions: [],
            logs: getLogs(),
            reports: [],
        });
    }
    
    const allPositions: Position[] = agents
      .map(a => a.openPosition)
      .filter((p): p is Position => p !== null);

    res.json({
        agents: agents.map(a => a.getStatus()),
        openPositions: allPositions,
        logs: getLogs(),
        reports: [], // Historical reports are no longer mocked
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
    if (agents.length === 0) {
        return res.status(500).json({ message: "No agents are initialized to start. Check server logs for configuration errors." });
    }

    log('SYSTEM', 'Received command to start trading for all agents.');
    hasStarted = true;
    
    // Stagger the start of each agent
    agents.forEach((agent, index) => {
        setTimeout(() => {
            // Use an async IIFE to handle the async start method
            (async () => {
                try {
                    await agent.start();
                } catch (e) {
                    // The error is already logged inside the agent.
                    // The agent's state will be set to ERROR and be visible on the dashboard.
                    console.error(`Agent ${agent.getStatus().id} failed to start:`, e instanceof Error ? e.message : String(e));
                }
            })();
        }, index * 15 * 1000); // 15 second stagger
    });

    res.status(200).json({ message: "Agents are starting their trading cycles." });
});

// --- DEBUGGING ENDPOINT ---
app.get('/debug/bybit-check', async (req, res) => {
    log('SYSTEM', 'Running Bybit connection test for agent P1 with hardcoded keys...');
    
    // --- TEMPORARY HARDCODED KEYS FOR DEBUGGING ---
    // This is the final test to prove the issue is with the keys/account, not the code's configuration loading.
    const apiKey = "e7TD5z3uWko2uSoqco";
    const apiSecret = "SkEzZVgUsbEjTrEneG0Q74iCU9iFK2yd7k0A";

    if (!apiKey || !apiSecret) {
        const message = 'Hardcoded P1 credentials for debug endpoint are missing.';
        log('SYSTEM', `Connection test failed: ${message}`);
        return res.status(500).json({ error: message });
    }

    try {
        const debugClient = new BybitClient('P1_DEBUG', apiKey, apiSecret);
        const bybitResponse = await debugClient.debugGetWalletBalance();
        log('SYSTEM', `Connection test complete. Bybit response: ${JSON.stringify(bybitResponse)}`);
        res.status(200).json(bybitResponse);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        log('SYSTEM', `Connection test failed with an unexpected error: ${message}`);
        res.status(500).json({ error: 'An unexpected error occurred during the test.', details: message });
    }
});


app.listen(PORT, () => {
    console.log(`FlipEdge Worker is running on port ${PORT}`);
    if (!process.env.API_KEY) {
        console.error("WARNING: Google Gemini API_KEY is not set in .env file. AI features will fail.");
        log('SYSTEM', "WARNING: Google Gemini API_KEY is not set.");
    }
    initializeAgents();
});