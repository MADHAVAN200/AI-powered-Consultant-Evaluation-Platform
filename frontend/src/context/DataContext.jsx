import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { analyzeData } from '../utils/intelligenceEngine';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || null);
  const [enterpriseData, setEnterpriseData] = useState({
    Revenue: 0,
    Cost: 0,
    Profit: 0,
    Margin: 0,
    AttritionRate: 0,
    ChurnRate: 0,
    LogisticsCost: 0
  });

  const [globalSignals, setGlobalSignals] = useState([]);
  const [historicalMetrics, setHistoricalMetrics] = useState([]);
  const [intelligence, setIntelligence] = useState({ insights: [], recommendations: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isBatching, setIsBatching] = useState(false);
  const [metadata, setMetadata] = useState({ columnCount: 0, rowCount: 0, mode: 'INITIALIZING' });
  const [systemStatus, setSystemStatus] = useState({
    api: 'OFFLINE',
    supabase: 'OFFLINE',
    groq: 'OFFLINE',
    lastSync: null
  });

  const hasData = historicalMetrics && historicalMetrics.length > 0;

  // Fetch Global Signals from Supabase
  const fetchGlobalSignals = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/global-signals');
      const data = await response.json();
      if (data.success) {
        setGlobalSignals(data.signals || []);
        setSystemStatus(prev => ({ ...prev, lastSync: new Date().toISOString() }));
      }
    } catch (error) {
      console.error("Failed to fetch global signals:", error);
    }
  }, []);

  // Periodic Health Check
  const checkSystemHealth = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/health');
      const data = await response.json();
      setSystemStatus(prev => ({
        ...prev,
        api: data.status === 'OK' ? 'ONLINE' : 'ERROR',
        supabase: data.supabaseConnected ? 'ONLINE' : 'OFFLINE',
        groq: data.groqConnected ? 'ONLINE' : 'OFFLINE'
      }));
    } catch (error) {
      setSystemStatus(prev => ({ ...prev, api: 'OFFLINE', supabase: 'OFFLINE', groq: 'OFFLINE' }));
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
        if (data.metrics && data.metrics.length > 0) {
          const latest = data.metrics[0];
          setEnterpriseData({
            Revenue: latest.revenue || 0,
            Cost: latest.cost || 0,
            Profit: latest.profit || 0,
            Margin: latest.margin || 0,
            AttritionRate: latest.attrition || 0,
            ChurnRate: latest.churn_rate || 0,
            LogisticsCost: latest.logistics_cost || 0
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
      fetchHistory();
    } catch (error) {
      console.error("Failed to save snapshot:", error);
    }
  };

  // Run AI analysis
  const runEnrichedAnalysis = useCallback(async (isFinalBatch = false) => {
    if (!userEmail) return;
    if (isBatching && !isFinalBatch) return;

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: userEmail, 
          metrics: enterpriseData, 
          history: historicalMetrics.slice(0, 20), 
          activeSignals: globalSignals 
        })
      });
      const data = await response.json();
      if (data.success) {
        setIntelligence(data.analysis);
        if (data.analysis.metadata) {
            setMetadata(data.metadata || { columnCount: 0, rowCount: 0, mode: 'PANDAS_CORE' });
        }
      } else {
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
  }, [enterpriseData, globalSignals, userEmail, isBatching, historicalMetrics]);

  useEffect(() => {
    if (userEmail) {
      fetchHistory();
      fetchGlobalSignals();
      checkSystemHealth();
      const interval = setInterval(checkSystemHealth, 30000); // Check every 30s
      return () => clearInterval(interval);
    }
  }, [userEmail, fetchHistory, fetchGlobalSignals, checkSystemHealth]);

  useEffect(() => {
    if (isBatching) return;
    const timer = setTimeout(() => {
      runEnrichedAnalysis();
    }, 5000);
    return () => clearTimeout(timer);
  }, [enterpriseData, globalSignals, runEnrichedAnalysis, isBatching]);

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
        fetchHistory();
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
      isLoading,
      setIsBatching,
      runEnrichedAnalysis,
      hasData,
      systemStatus,
      metadata
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
