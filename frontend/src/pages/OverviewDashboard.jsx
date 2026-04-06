import React, { useState } from 'react';
import IntelligenceSidebar from '../components/IntelligenceSidebar';
import MarketSimulator from '../components/MarketSimulator';
import { useData } from '../context/DataContext';

const HistoricalTrendChart = ({ data }) => {
  if (!data || data.length < 2) {
    return (
      <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', opacity: 0.4, border: '1px dashed var(--border-default)', borderRadius: '8px' }}>
        INSUFFICIENT DATA FOR TREND ANALYSIS
      </div>
    );
  }

  const maxRev = Math.max(...data.map(d => d.revenue));
  const minRev = Math.min(...data.map(d => d.revenue));
  const range = maxRev - minRev || 1;
  const trendData = data.slice(0, 50).reverse();
  const points = trendData.map((d, i) => {
    const x = (i / (trendData.length - 1 || 1)) * 100;
    const y = 40 - ((d.revenue - minRev) / range) * 30;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: '800', opacity: 0.5 }}>REVENUE TREND (LONG-TERM)</span>
            <span style={{ fontSize: '0.6rem', color: '#52c41a', fontWeight: '800' }}>
                {trendData.length > 1 ? `+${((trendData[trendData.length-1].revenue / trendData[0].revenue - 1) * 100).toFixed(1)}%` : '0%'}
            </span>
        </div>
        <svg viewBox="0 0 100 40" style={{ width: '100%', height: '40px', overflow: 'visible' }}>
            <polyline fill="none" stroke="var(--accent-primary)" strokeWidth="2" points={points} />
        </svg>
    </div>
  );
};

const OverviewDashboard = () => {
  const { enterpriseData, globalSignals, intelligence, isLoading, historicalMetrics } = useData();
  const [selectedItem, setSelectedItem] = useState(null);
  const [sidebarType, setSidebarType] = useState(null);

  const formatIndianNumber = (num, isCurrency = true) => {
    if (!num && num !== 0) return 'N/A';
    const formatter = new Intl.NumberFormat('en-IN', {
      style: isCurrency ? 'currency' : 'decimal',
      currency: 'INR',
      maximumFractionDigits: 1
    });

    if (num >= 10000000) {
      return `${isCurrency ? '₹' : ''}${(num / 10000000).toFixed(2)} Cr`;
    } else if (num >= 100000) {
      return `${isCurrency ? '₹' : ''}${(num / 100000).toFixed(2)} L`;
    }
    return formatter.format(num);
  };

  if (isLoading && (!intelligence || !intelligence.insights || intelligence.insights.length === 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '20px' }}>
        <div className="loader"></div>
        <div style={{ fontSize: '0.8rem', fontWeight: '800', opacity: 0.5, letterSpacing: '0.2em' }}>SYNCHRONIZING ENTERPRISE INTELLIGENCE...</div>
      </div>
    );
  }

  const openSidebar = (item, type) => {
    setSelectedItem(item);
    setSidebarType(type);
  };

  const closeSidebar = () => {
    setSelectedItem(null);
    setSidebarType(null);
  };

  const getDynamicMetrics = () => {
    const base = [
        { name: "Revenue", value: formatIndianNumber(enterpriseData.Revenue), trend: "up" },
        { name: "Profit", value: formatIndianNumber(enterpriseData.Profit), trend: "up" },
        { name: "Margin", value: `${enterpriseData.Margin}%`, trend: enterpriseData.Margin > 20 ? "up" : "down" },
    ];

    if ('UtilizationRate' in enterpriseData) {
        base.push({ name: "Utilization", value: `${enterpriseData.UtilizationRate}%`, trend: enterpriseData.UtilizationRate > 75 ? "up" : "down" });
        base.push({ name: "Attrition", value: `${enterpriseData.AttritionRate}%`, trend: enterpriseData.AttritionRate > 15 ? "down" : "up" });
        base.push({ name: "Billable", value: enterpriseData.BillableHeadcount, trend: "up" });
    } else if ('MRR' in enterpriseData) {
        base.push({ name: "MRR", value: formatIndianNumber(enterpriseData.MRR), trend: "up" });
        base.push({ name: "Churn", value: `${enterpriseData.ChurnRate}%`, trend: enterpriseData.ChurnRate > 5 ? "down" : "up" });
        base.push({ name: "Active Users", value: (enterpriseData.ActiveUsers / 1000).toFixed(1) + 'k', trend: "up" });
    } else {
        base.push({ name: "Logistics", value: formatIndianNumber(enterpriseData.LogisticsCost), trend: "down" });
        base.push({ name: "Churn", value: `${enterpriseData.ChurnRate}%`, trend: "down" });
    }

    return base.slice(0, 6);
  };

  const dynamicMetrics = getDynamicMetrics();
  const healthScore = enterpriseData.Margin < 10 || (enterpriseData.AttritionRate > 20 || enterpriseData.ChurnRate > 8) ? 38 : 72;
  const healthStatus = healthScore < 50 ? "CRITICAL" : "HEALTHY";
  const healthColor = healthScore < 50 ? "#ff4d4f" : "#52c41a";

  const safeInsights = intelligence?.insights || [];
  const safeRecommendations = intelligence?.recommendations || [];

  return (
    <div className="dashboard-grid">
      {/* Metrics Row (A) */}
      <div className="metrics-row">
        {dynamicMetrics.map((m, i) => (
          <div key={i} className="metric-card">
            <span className="metric-name">{m.name.toUpperCase()}</span>
            <div className="metric-value-container">
              <span className="metric-value">{m.value}</span>
              <span className={`trend-indicator ${m.trend}`}>{m.trend === "up" ? "▲" : "▼"}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="main-content-row">
        {/* Market Context (B) */}
        <div className="panel" style={{ flex: 1.5 }}>
          <header className="panel-header">
              <span>Market Intelligence Stream</span>
              <span style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'var(--accent-primary)', borderRadius: '4px', color: 'white' }}>LIVE</span>
          </header>
          <div className="panel-content scrollable">
            {globalSignals.map((sig) => (
              <div key={sig.id} className="signal-card" style={{ borderLeft: `4px solid ${sig.impact === 'High' ? '#ff4d4f' : '#52c41a'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="signal-title">{sig.title}</span>
                  <span className="signal-impact" style={{ color: sig.impact === 'High' ? '#ff4d4f' : '#52c41a' }}>{sig.impact} IMPACT</span>
                </div>
                <p className="signal-description">{sig.description}</p>
                <div style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '8px' }}>SOURCE: {sig.source.toUpperCase()} | PERSPECTIVE: {sig.perspective.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Health Hub (C) */}
        <div className="panel" style={{ flex: 1 }}>
          <header className="panel-header"><span>Enterprise Health Index</span></header>
          <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '3rem', fontWeight: '900', color: healthColor }}>{healthScore}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.2em' }}>{healthStatus}</div>
            </div>
            
            <HistoricalTrendChart data={historicalMetrics} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <div style={{ fontSize: '0.65rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Liquidity Buffer</span>
                  <span style={{ fontWeight: '800' }}>84.2%</span>
               </div>
               <div className="progress-bar"><div className="progress-fill" style={{ width: '84.2%' }}></div></div>
               
               <div style={{ fontSize: '0.65rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Risk Exposure</span>
                  <span style={{ fontWeight: '800', color: healthColor }}>{100 - healthScore}%</span>
               </div>
               <div className="progress-bar"><div className="progress-fill" style={{ width: `${100 - healthScore}%`, background: healthColor }}></div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-row">
          {/* Reasoning Agents (D) */}
          <div className="panel" style={{ flex: 1 }}>
            <header className="panel-header" style={{ color: 'var(--accent-primary)' }}>
              <span>Live AI Reasoning Agents</span>
            </header>
            <div className="panel-content scrollable">
              {safeInsights.length > 0 ? (
                safeInsights.map((insight) => (
                  <div key={insight.id} onClick={() => openSidebar(insight, 'agent')} style={{ fontSize: '0.8rem', padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: `3px solid ${insight.type === 'critical' ? '#ff4d4f' : insight.type === 'warning' ? '#fa8c1f' : '#52c41a'}`, marginBottom: '8px', background: 'rgba(255,255,255,0.01)', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: '900', color: insight.type === 'critical' ? '#ff4d4f' : 'var(--accent-primary)', opacity: 0.8 }}>[{insight.type.toUpperCase()}]</span>
                    <span style={{ fontWeight: '600' }}>{insight.title}</span>
                  </div>
                ))
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', opacity: 0.4 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.1em' }}>NO ACTIVE REASONING AGENTS...</div>
                </div>
              )}
            </div>
          </div>

          {/* Top Recommendations (E) */}
          <div className="panel" style={{ flex: 1.2 }}>
            <header className="panel-header" style={{ color: 'var(--accent-primary)' }}>
              <span>Strategic Priority Matrix</span>
            </header>
            <div className="panel-content">
              {safeRecommendations.length > 0 ? (
                safeRecommendations.slice(0, 4).map((rec) => (
                  <div key={rec.id || rec.title} className="list-item" onClick={() => openSidebar(rec, 'recommendation')} style={{ borderBottom: '1px solid var(--border-default)', cursor: 'pointer' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{rec.title}</div>
                        <span style={{ fontSize: '0.6rem', padding: '2px 6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px solid var(--border-default)', fontWeight: '900', color: 'var(--accent-primary)' }}>
                            {rec.perspective?.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: '#52c41a', fontWeight: '800' }}>{rec.impact}</span>
                        <span style={{ fontSize: '0.65rem', opacity: 0.6, fontWeight: '700' }}>CONF: {Math.round(rec.confidence * 100)}%</span>
                        <div style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: rec.risk === 'High' ? 'rgba(245, 34, 45, 0.1)' : 'rgba(82, 196, 26, 0.1)', color: rec.risk === 'High' ? '#f5222d' : '#52c41a', fontWeight: '900' }}>
                           {rec.risk?.toUpperCase()} RISK
                        </div>
                      </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', opacity: 0.4 }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '12px' }}>📊</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.1em' }}>WAITING FOR SNAPSHOT...</div>
                </div>
              )}
            </div>
          </div>
      </div>

      <MarketSimulator />

      {selectedItem && (
        <IntelligenceSidebar 
          data={selectedItem} 
          type={sidebarType} 
          onClose={closeSidebar} 
        />
      )}
    </div>
  );
};

export default OverviewDashboard;
