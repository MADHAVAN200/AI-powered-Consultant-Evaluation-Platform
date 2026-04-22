import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../config/api';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || null);
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || null);
  const [systemStatus, setSystemStatus] = useState({
    api: 'OFFLINE',
    supabase: 'OFFLINE',
    groq: 'OFFLINE',
    lastSync: null
  });

  // Periodic Health Check
  const checkSystemHealth = useCallback(async () => {
    try {
      const response = await fetch(apiUrl('/health'));
      const data = await response.json();
      setSystemStatus(prev => ({
        ...prev,
        api: data.status === 'OK' ? 'ONLINE' : 'ERROR',
        supabase: data.supabaseConnected ? 'ONLINE' : 'OFFLINE',
        groq: data.groqConnected ? 'ONLINE' : 'OFFLINE',
        lastSync: new Date().toISOString()
      }));
    } catch (error) {
      setSystemStatus(prev => ({ ...prev, api: 'OFFLINE', supabase: 'OFFLINE', groq: 'OFFLINE' }));
    }
  }, []);

  // Login logic
  const loginUser = (username, password) => {
    let role = null;
    let email = username;

    if (username === 'admin' && password === '1234') {
        role = 'admin';
        email = 'admin@enterprise.ai';
    } else if (username === 'user' && password === '1234') {
        role = 'candidate';
        email = 'candidate@enterprise.ai';
    }

    if (role) {
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userRole', role);
        setUserEmail(email);
        setUserRole(role);
        return { success: true, role };
    }
    
    return { success: false, error: 'INVALID CREDENTIALS' };
  };

  const logoutUser = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    setUserEmail(null);
    setUserRole(null);
  };

  useEffect(() => {
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [checkSystemHealth]);

  return (
    <DataContext.Provider value={{ 
      userEmail, 
      userRole,
      loginUser, 
      logoutUser,
      systemStatus
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
