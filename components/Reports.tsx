
import React from 'react';

interface ReportsProps {
  reports: string[];
}

const Reports: React.FC<ReportsProps> = ({ reports }) => {
    
  const handleDownloadToday = () => {
    // In a real app, this would trigger a download from an API endpoint
    alert("Downloading today's live trade data...");
  };
    
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg p-4">
      <h2 className="text-lg font-semibold text-gray-200 mb-4">Reports</h2>
      <button 
        onClick={handleDownloadToday}
        className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-300 mb-4"
      >
        Download Today's Trades (Live CSV)
      </button>
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2">Historical Reports</h3>
        <ul className="space-y-2">
            {reports.map((reportName) => (
                <li key={reportName}>
                    <a href="#" className="text-blue-400 hover:text-blue-300 hover:underline text-sm">
                        {reportName}
                    </a>
                </li>
            ))}
        </ul>
      </div>
    </div>
  );
};

export default Reports;
