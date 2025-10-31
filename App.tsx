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
            // The UI will update on the next successful poll from useAgentData
            alert('Start command sent successfully! Agent is now active.');
        } catch (err) {
            console.error('Error starting agents:', err);
            if (err instanceof Error) {
                alert(`Error: ${err.message}`);
            } else {
                alert('An unknown error occurred while trying to start the agent.');
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
    const totalPnl = data.agents.reduce((sum, a) => sum + a.pnl, 0);
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
                        onClick={handleStartTrading}
                        disabled={hasStarted}
                        className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        {hasStarted ? 'Agent Active' : 'Start Trading'}
                    </button>
                </div>
            </header>

            <main>
                {/* KPIs */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <KpiCard title="Total PnL (24h)" value={totalPnl} />
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Main Content: Tables */}
                    <div className="xl:col-span-2 flex flex-col gap-8">
                        <AccountsTable title="Trading Agent" agents={profitAgents} borderColor="border-green-500" />
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