import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { analyzeData } from '../utils/intelligenceEngine';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || null);
  const [enterpriseData, setEnterpriseData] = useState({
    Revenue: 12400000,
    Cost: 8200000,
    Profit: 4200000,
    Margin: 34,
    AttritionRate: 4.2,
    ChurnRate: 4.1,
    LogisticsCost: 1450000
  });

  const [globalSignals, setGlobalSignals] = useState([]);
  const [historicalMetrics, setHistoricalMetrics] = useState([]);
  const [intelligence, setIntelligence] = useState({ insights: [], recommendations: [] });
  const [isLoading, setIsLoading] = useState(false);

  // Fetch Global Signals from Supabase
  const fetchGlobalSignals = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/global-signals');
      const data = await response.json();
      if (data.success) {
        setGlobalSignals(data.signals || []);
      }
    } catch (error) {
      console.error("Failed to fetch global signals:", error);
    }
  }, []);

  // Login logic
  const loginUser = (email) => {
    localStorage.setItem('userEmail', email);
    setUserEmail(email);
  };

  const logoutUser = () => {
    localStorage.removeItem('userEmail');
    setUserEmail(null);
  };

  // Fetch History from Backend
  const fetchHistory = useCallback(async () => {
    if (!userEmail) return;
    try {
      const response = await fetch(`http://localhost:5000/api/history?email=${userEmail}`);
      const data = await response.json();
      if (data.success) {
        setHistoricalMetrics(data.metrics || []);
        // If we have historical data, set the latest as current
        if (data.metrics && data.metrics.length > 0) {
          const latest = data.metrics[0];
          setEnterpriseData({
            Revenue: latest.revenue,
            Cost: latest.cost,
            Profit: latest.profit,
            Margin: latest.margin,
            AttritionRate: latest.attrition,
            ChurnRate: latest.churn_rate,
            LogisticsCost: latest.logistics_cost
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  }, [userEmail]);

  // Save current snapshot
  const saveSnapshot = async (metrics, rawData = null) => {
    if (!userEmail) return;
    try {
      await fetch('http://localhost:5000/api/save-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, metrics, rawData })
      });
      fetchHistory(); // Refresh history after save
    } catch (error) {
      console.error("Failed to save snapshot:", error);
    }
  };

  // Update backend with new analysis whenever metrics/signals change
  const runEnrichedAnalysis = useCallback(async () => {
    if (!userEmail) return;
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: userEmail, 
          metrics: enterpriseData, 
          history: historicalMetrics.slice(0, 50), // Send last 50 snapshots
          activeSignals: globalSignals 
        })
      });
      const data = await response.json();
      if (data.success) {
        setIntelligence(data.analysis);
      } else {
        // Fallback to local engine if backend fails
        const localResults = analyzeData(enterpriseData, globalSignals);
        setIntelligence(localResults);
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      const localResults = analyzeData(enterpriseData, globalSignals);
      setIntelligence(localResults);
    } finally {
      setIsLoading(false);
    }
  }, [enterpriseData, globalSignals, userEmail]);

  // Initial fetch on login
  useEffect(() => {
    if (userEmail) {
      fetchHistory();
      fetchGlobalSignals();
    }
  }, [userEmail, fetchHistory, fetchGlobalSignals]);

  // Debounced analysis run
  useEffect(() => {
    const timer = setTimeout(() => {
      runEnrichedAnalysis();
    }, 1000);
    return () => clearTimeout(timer);
  }, [enterpriseData, globalSignals, runEnrichedAnalysis]);

  const updateMetrics = (newData, rawData = null) => {
    setEnterpriseData(prev => ({ ...prev, ...newData }));
    saveSnapshot({ ...enterpriseData, ...newData }, rawData);
  };

  const toggleSignal = (signal) => {
    setGlobalSignals(prev => {
      const exists = prev.find(s => s.id === signal.id);
      if (exists) return prev.filter(s => s.id !== signal.id);
      return [...prev, signal];
    });
  };

  const deleteSnapshot = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/delete-snapshot/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        fetchHistory(); // Refresh the list
      }
    } catch (error) {
      console.error("Failed to delete snapshot:", error);
    }
  };

  return (
    <DataContext.Provider value={{ 
      userEmail, 
      loginUser, 
      logoutUser,
      enterpriseData, 
      globalSignals, 
      intelligence, 
      historicalMetrics,
      updateMetrics, 
      deleteSnapshot,
      toggleSignal,
      isLoading 
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
