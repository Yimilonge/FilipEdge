import { useState, useEffect } from 'react';
import { ApiStatusResponse } from '../types';

export const useAgentData = () => {
    const [data, setData] = useState<ApiStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/api/status');
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }
                const json: ApiStatusResponse = await response.json();
                setData(json);
                setError(null);
            } catch (err) {
                 if (err instanceof Error) {
                  setError(`Failed to connect to the backend worker: ${err.message}`);
                } else {
                  setError('An unknown error occurred while fetching data.');
                }
            } finally {
                // Only set loading to false after the first fetch attempt
                if (loading) {
                    setLoading(false);
                }
            }
        };

        fetchData(); // Initial fetch
        const intervalId = setInterval(fetchData, 5000);

        return () => clearInterval(intervalId);
    }, [loading]);

    return { data, loading, error };
};
