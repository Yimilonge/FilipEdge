
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Agent } from './agent';
import { strategies } from './strategies.config';
import { getLogs, log } from './logger';
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
    for (const strategy of strategies) {
        const apiKey = process.env[`BYBIT_API_KEY_${strategy.id}`];
        const apiSecret = process.env[`BYBIT_API_SECRET_${strategy.id}`];

        if (apiKey && apiSecret) {
            initializedAgents.push(new Agent(strategy, apiKey, apiSecret));
            log('SYSTEM', `Agent ${strategy.id} (${strategy.name}) initialized.`);
        } else {
            log('SYSTEM', `WARN: Missing API keys for agent ${strategy.id}. Agent will not be created.`);
        }
    }
    agents = initializedAgents;
    log('SYSTEM', `Initialization complete. ${agents.length} agents are ready.`);
};

// API Endpoint to get status
app.get('/api/status', async (req, res) => {
    if (agents.length === 0) {
        return res.status(503).json({ error: "Agents not initialized." });
    }
    
    // In a real scenario, you'd update agent state before sending
    // For simplicity, we assume agent internal state is fresh enough
    
    const allPositions: Position[] = agents
      .map(a => a.openPosition)
      .filter((p): p is Position => p !== null);

    const reports = [
        `trades-2024-07-20.csv`,
        `trades-2024-07-19.csv`,
        `trades-2024-07-18.csv`,
    ];

    res.json({
        agents: agents.map(a => a.getStatus()),
        openPositions: allPositions,
        logs: getLogs(),
        reports,
    });
});

// API Endpoint to start trading
app.post('/api/start', (req, res) => {
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
        }, index * 75 * 1000); // 75 second stagger
    });

    res.status(200).json({ message: "Agents are starting their trading cycles." });
});


app.listen(PORT, () => {
    console.log(`FlipEdge Worker is running on port ${PORT}`);
    if (!process.env.API_KEY) {
        console.error("FATAL: Google Gemini API_KEY is not set in .env file.");
        log('SYSTEM', "FATAL: Google Gemini API_KEY is not set.");
        // process.exit(1);
    }
    initializeAgents();
});
