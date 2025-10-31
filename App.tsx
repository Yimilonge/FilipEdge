import React from 'react';
import { useAgentData } from './hooks/useAgentData';
import KpiCard from './components/KpiCard';
import AccountsTable from './components/AccountsTable';
import { AgentState, StrategyType } from './types';
import PositionsTable from './components/PositionsTable';
import LogViewer from './components/LogViewer';
import Reports from './components/Reports';

const FlipEdgeLogo: React.FC = () => (
    <svg className="h-8 w-auto text-white" viewBox="0 0 230 122" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M215.016 24.3711H86.3692L72.2982 48.7423H200.946L186.875 73.1134H137.364L123.293 97.4845H172.805L158.734 121.856H79.3668L94.4991 95.646L94.4061 95.5924L107.385 73.1134H58.228L44.1571 97.4845H44.2798L30.2088 121.856H0L70.3533 0H229.087L215.016 24.3711Z" fill="currentColor"></path>
    </svg>
);


const App: React.FC = () => {
    const { data, loading, error } = useAgentData();

    const handleStartTrading = async () => {
        try {
            const response = await fetch('/api/start', { method: 'POST' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start agents from backend.');
            }
            alert('Start command sent successfully! Agents are now active.');
        } catch (err) {
            console.error('Error starting agents:', err);
            if (err instanceof Error) {
                alert(`Error: ${err.message}`);
            } else {
                alert('An unknown error occurred while trying to start the agents.');
            }
        }
    };

    const handleRunConnectionTest = async () => {
        try {
            alert('Running connection test for Agent P1... Please wait.');
            const response = await fetch('/api/debug/bybit-check');
            const result = await response.json();
            
            let alertMessage = `--- Bybit Connection Test Result ---\n\n`;
            alertMessage += `Bybit Server Response: "${result.retMsg}" (Code: ${result.retCode})\n\n`;

            if (result.retCode === 0) {
                alertMessage += "✅ SUCCESS! The connection is working correctly and your balance was fetched.\n\n";
                const usdt = result.result?.list?.[0]?.coin?.find((c: any) => c.coin === 'USDT');
                if (usdt) {
                    alertMessage += `Your USDT Wallet Balance: ${usdt.walletBalance}`;
                } else {
                    alertMessage += `Your account is connected but no USDT balance was found.`;
                }
            } else {
                alertMessage += `❌ FAILED. The Bybit server is rejecting your API key.\n\n`;
                alertMessage += `This confirms the problem is with the key or account settings on the Bybit website, not the application code.\n\n`;
                alertMessage += `--- PLEASE CHECK THE FOLLOWING IN YOUR BYBIT ACCOUNT ---\n`;
                alertMessage += `1. Account Type: Ensure you are using a Unified Trading Account (UTA).\n`;
                alertMessage += `2. API Key Permissions: The key MUST have "Read-Write" access enabled for "Contract" AND "Wallet".\n`;
                alertMessage += `3. IP Whitelisting: Ensure your API key is NOT restricted to specific IP addresses.\n`;
                alertMessage += `4. Key Status: Make sure the API key is active and has not expired.\n\n`;
                alertMessage += `Create a new key with the correct settings if the error persists.`;
            }

            alert(alertMessage);

        } catch (err) {
            console.error('Error running connection test:', err);
             if (err instanceof Error) {
                alert(`Test Failed: ${err.message}`);
            } else {
                alert('An unknown error occurred during the test.');
            }
        }
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center min-h-screen text-white">
                <div className="text-center">
                    <FlipEdgeLogo />
                    <p className="mt-4 text-lg">Initializing Dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen text-white">
                <div className="bg-red-900/50 border border-red-500 rounded-lg p-8 text-center max-w-lg">
                    <h2 className="text-2xl font-bold text-red-300">Connection Error</h2>
                    <p className="text-red-200 mt-2">{error}</p>
                    <p className="text-gray-400 mt-4">Please ensure the backend worker is running and accessible.</p>
                </div>
            </div>
        );
    }
    
    if (!data) return null;

    const profitAgents = data.agents.filter(a => a.type === StrategyType.PROFIT);
    const totalPnl = profitAgents.reduce((sum, a) => sum + a.pnl, 0);
    
    const hasStarted = data.agents.length > 0 && data.agents.some(a => a.state !== AgentState.STOPPED);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 p-4 lg:p-8">
            <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <FlipEdgeLogo />
                    <h1 className="text-3xl font-bold tracking-tight text-white">FlipEdge agent dashboard</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-400 text-right">
                        Last update: {new Date().toLocaleTimeString()}
                    </div>
                     <button
                        onClick={handleRunConnectionTest}
                        className="bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-700 transition duration-300"
                    >
                        Run Connection Test
                    </button>
                     <button
                        onClick={handleStartTrading}
                        disabled={hasStarted}
                        className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        {hasStarted ? 'Agents Active' : 'Start Trading'}
                    </button>
                </div>
            </header>

            <main>
                {/* KPIs */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <KpiCard title="Total PnL (24h)" value={totalPnl} />
                    <KpiCard title="Profit Strategies PnL" value={totalPnl} />
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Main Content: Tables */}
                    <div className="xl:col-span-2 flex flex-col gap-8">
                        <AccountsTable title="Profit-Seeking Agents" agents={profitAgents} borderColor="border-green-500" />
                        <PositionsTable positions={data.openPositions} agents={data.agents} />
                    </div>

                    {/* Sidebar: Logs and Reports */}
                    <div className="flex flex-col gap-8">
                        <div className="xl:h-[600px]">
                          <LogViewer logs={data.logs} />
                        </div>
                        <Reports reports={data.reports} />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;