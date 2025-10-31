
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

let agents: Agent[] = [];
let hasStarted = false;

const initializeAgents = () => {
    log('SYSTEM', 'Initializing agents...');
    const initializedAgents: Agent[] = [];
    // Creating dummy keys for demo purposes if not set.
    // In a real environment, these should be securely set.
    const DUMMY_KEY = "DUMMY_KEY";
    const DUMMY_SECRET = "DUMMY_SECRET";

    for (const strategy of strategies) {
        // Use environment variables if they exist, otherwise use dummies for initialization to proceed.
        const apiKey = process.env[`BYBIT_API_KEY_${strategy.id}`] || DUMMY_KEY;
        const apiSecret = process.env[`BYBIT_API_SECRET_${strategy.id}`] || DUMMY_SECRET;

        initializedAgents.push(new Agent(strategy, apiKey, apiSecret));
        log('SYSTEM', `Agent ${strategy.id} (${strategy.name}) initialized.`);
    }
    agents = initializedAgents;
    log('SYSTEM', `Initialization complete. ${agents.length} agents are ready.`);
};


// API Endpoint to get status
app.get('/status', async (req, res) => {
    if (agents.length === 0) {
        return res.status(503).json({ error: "Agents not initialized." });
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
        return res.status(500).json({ message: "No agents are initialized to start." });
    }

    log('SYSTEM', 'Received command to start trading for all agents.');
    hasStarted = true;
    
    // Stagger the start of each agent
    agents.forEach((agent, index) => {
        setTimeout(() => {
            agent.start();
        }, index * 15 * 1000); // 15 second stagger
    });

    res.status(200).json({ message: "Agents are starting their trading cycles." });
});


app.listen(PORT, () => {
    console.log(`FlipEdge Worker is running on port ${PORT}`);
    if (!process.env.API_KEY) {
        console.error("WARNING: Google Gemini API_KEY is not set in .env file. AI features will fail.");
        log('SYSTEM', "WARNING: Google Gemini API_KEY is not set.");
    }
    initializeAgents();
});
