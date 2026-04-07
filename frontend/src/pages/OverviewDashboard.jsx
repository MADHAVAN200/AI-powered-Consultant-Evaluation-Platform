import React, { useState, useEffect } from 'react';
import IntelligenceSidebar from '../components/IntelligenceSidebar';
import MarketSimulator from '../components/MarketSimulator';
import { useData } from '../context/DataContext';

const MetricSparkline = ({ data, dataKey, color, label, isArea = false, formatFn = Math.round }) => {
  if (!data || data.length < 2) return null;
  const values = data.map(d => Number(d[dataKey]) || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const h = 40, w = 100;
  
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 10) - 5;
    return `${x},${y}`;
  });
  
  const linePoints = points.join(' ');
  const areaPoints = `${points[0].split(',')[0]},${h} ${linePoints} ${points[points.length-1].split(',')[0]},${h}`;
  
  const delta = values[values.length - 1] - values[0];
  const pct = ((delta / (Math.abs(values[0]) || 1)) * 100).toFixed(1);
  const isPos = delta >= 0;

  return (
    <div style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-default)', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--text-primary)' }}>{formatFn(values[values.length - 1])}</span>
          <span style={{ 
              fontSize: '0.65rem', 
              color: isPos ? '#52c41a' : '#ff4d4f', 
              fontWeight: '800', 
              background: isPos ? 'rgba(82,196,26,0.1)' : 'rgba(255,77,79,0.1)', 
              padding: '2px 6px', 
              borderRadius: '4px' 
          }}>
            {isPos ? '+' : ''}{pct}%
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '40px', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad-${label.replace(/\s+/g,'-')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        {isArea && <polygon points={areaPoints} fill={`url(#grad-${label.replace(/\s+/g,'-')})`} />}
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={linePoints} strokeLinejoin="round" />
        <circle cx={points[points.length-1].split(',')[0]} cy={points[points.length-1].split(',')[1]} r="2" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
    </div>
  );
};

const EnterpriseMetricsVisualizer = ({ data }) => {
  if (!data || data.length < 2) {
    return (
      <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', opacity: 0.5, border: '1px dashed var(--border-default)', borderRadius: '8px' }}>
        INSUFFICIENT HISTORICAL DATA FOR ADVANCED TELEMETRY
      </div>
    );
  }

  const trendData = [...data].slice(0, 50).reverse();

  const formatShort = (num) => {
    if (num >= 1e7) return `₹${(num/1e7).toFixed(1)}Cr`;
    if (num >= 1e5) return `₹${(num/1e5).toFixed(1)}L`;
    if (num >= 1e3) return `₹${(num/1e3).toFixed(1)}k`;
    return `₹${num.toLocaleString()}`;
  };

  return (
    <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <h4 style={{ fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.1em', marginBottom: '16px', color: 'var(--text-secondary)' }}>STRATEGIC VECTORS</h4>
      <MetricSparkline data={trendData} dataKey="revenue" color="var(--accent-primary)" label="REVENUE VELOCITY" isArea={true} formatFn={formatShort} />
      <MetricSparkline data={trendData} dataKey="profit" color="#52c41a" label="PROFIT MOMENTUM" isArea={true} formatFn={formatShort} />
      {trendData[0].margin !== undefined && (
        <MetricSparkline data={trendData} dataKey="margin" color="#faad14" label="OPERATING MARGIN" formatFn={(v) => `${v.toFixed(1)}%`} />
      )}
    </div>
  );
};

const RadialHealthGauge = ({ score, color, status }) => {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: '140px', height: '140px', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="140" height="140" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}>
        {/* Background track */}
        <circle cx="50" cy="50" r={radius} fill="var(--bg-subtle)" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
        
        {/* Progress bar */}
        <circle 
          cx="50" cy="50" r={radius} 
          fill="none" 
          stroke={color} 
          strokeWidth="6" 
          strokeDasharray={circumference} 
          strokeDashoffset={offset} 
          strokeLinecap="round" 
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)', filter: `drop-shadow(0 0 8px ${color}80)` }}
        />
        
        {/* Inner subtle glow */}
        <circle cx="50" cy="50" r={radius - 8} fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 4" strokeOpacity="0.2" />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: '3rem', fontWeight: '900', color: color, textShadow: `0 0 20px ${color}60`, lineHeight: '1', fontFamily: "'Inter', sans-serif" }}>{score}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 8px ${color}` }}></div>
            <span style={{ fontSize: '0.6rem', fontWeight: '800', letterSpacing: '0.1em', opacity: 0.9 }}>{status}</span>
        </div>
      </div>
    </div>
  );
};

const OverviewDashboard = () => {
  const { enterpriseData, globalSignals, intelligence, isLoading, historicalMetrics, userEmail, hasData } = useData();
  const [selectedItem, setSelectedItem] = useState(null);
  const [sidebarType, setSidebarType] = useState(null);
  const [allDecisions, setAllDecisions] = useState([]);

  useEffect(() => {
    const fetchAllDecisions = async () => {
      if (!userEmail) return;
      try {
        const response = await fetch(`http://localhost:5000/api/all-decisions?email=${userEmail}`);
        const data = await response.json();
        if (data.success) {
          setAllDecisions(data.decisions || []);
        }
      } catch (error) {
        console.error("Failed to fetch historical decisions:", error);
      }
    };
    fetchAllDecisions();
  }, [userEmail]);

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

  const getHealthDiagnostic = () => {
    if (healthScore >= 90) return "Enterprise health is exceptional. All core KPIs are performing in the top decile, with margin and retention metrics significantly exceeding industry baselines.";
    if (healthScore >= 70) return "Strategic health is stable. Operational velocity is aligned with Q3 targets, and risk vectors are currently well-hedged against market volatility.";
    if (healthScore >= 50) return "Cautionary state detected. While revenue remains baseline, emerging headwinds in cost-of-delivery or customer churn suggest a need for strategic recalibration.";
    
    // Critical Cases
    if (enterpriseData.Margin < 10) return "CRITICAL ALERT: Operational health is compromised by a severe margin outlier (<10%). Immediate liquidity and cost-base forensics are required to stabilize burn.";
    if (enterpriseData.AttritionRate > 20) return "TALENT RISK: Resilience is critical due to attrition exceeding the 20% threshold. This represents a systemic threat to delivery capacity and institutional knowledge.";
    if (enterpriseData.ChurnRate > 10) return "REVENUE RISK: Customer attrition has breached the 10% critical barrier. Current LTV/CAC ratios are unsustainable without immediate retention intervention.";
    
    return "Strategic health is below baseline. Combined performance metrics indicate a high-risk operational vector across multiple KPIs.";
  };

  const safeInsights = intelligence?.insights || [];
  const safeRecommendations = intelligence?.recommendations || [];

  const openSidebar = (item, type) => {
    setSelectedItem(item);
    setSidebarType(type);
  };

  const closeSidebar = () => {
    setSelectedItem(null);
    setSidebarType(null);
  };

  // Removed full-page loader to allow for inline skeleton UI

  if (!hasData) {
    return (
      <div className="dashboard-grid" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 20px' }}>
        <div className="panel" style={{ maxWidth: '600px', padding: '48px', border: '1px dashed var(--accent-primary)', background: 'rgba(0, 82, 204, 0.02)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '24px' }}>📊</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '16px' }}>READY FOR INTELLIGENCE INGESTION</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px' }}>
            The Strategic Advisor engine is online and awaiting your enterprise data. 
            Connect your ERP, CRM, or upload a high-density CSV to begin generating Alpha-Reasoning insights.
          </p>
          <a href="/data" style={{ 
            display: 'inline-block',
            padding: '12px 32px', 
            background: 'var(--accent-primary)', 
            color: 'white', 
            borderRadius: '8px', 
            fontWeight: '700', 
            textDecoration: 'none',
            fontSize: '0.9rem',
            transition: 'transform 0.2s'
          }} onMouseEnter={e => e.target.style.transform = 'scale(1.05)'} onMouseLeave={e => e.target.style.transform = 'scale(1)'}>
            INGEST FIRST DATASET ➔
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <div className="metrics-row">
        {dynamicMetrics.map((m, i) => (
          <div key={i} className="metric-card">
            <span className="metric-name">{m.name.toUpperCase()}</span>
            <div className="metric-value-container">
              {isLoading ? (
                <div className="skeleton" style={{ height: '1.35rem', width: '80px' }}></div>
              ) : (
                <>
                  <span className="metric-value">{m.value}</span>
                  <span className={`trend-indicator ${m.trend}`}>{m.trend === "up" ? "▲" : "▼"}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="main-content-row">
        <div className="panel">
          <header className="panel-header"><span>Market Intelligence Stream</span></header>
          <div className="panel-content scrollable">
            {isLoading && globalSignals.length === 0 ? (
              [1, 2, 3].map(i => (
                <div key={i} className="signal-card" style={{ padding: '16px' }}>
                  <div className="skeleton-title skeleton"></div>
                  <div className="skeleton-text skeleton"></div>
                  <div className="skeleton-text skeleton" style={{ width: '40%' }}></div>
                </div>
              ))
            ) : (
              globalSignals.map((sig) => (
                <div 
                  key={sig.id} 
                  onClick={() => openSidebar(sig, 'signal')}
                  className="signal-card clickable" 
                  style={{ borderLeft: `4px solid ${sig.severity === 'High' || sig.severity === 'Critical' ? '#ff4d4f' : '#52c41a'}`, padding: '12px', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="signal-title">{sig.type}</span>
                    <span className="signal-impact" style={{ color: sig.severity === 'High' || sig.severity === 'Critical' ? '#ff4d4f' : '#52c41a' }}>{sig.severity?.toUpperCase()} IMPACT</span>
                  </div>
                  <p className="signal-description">{sig.event}</p>
                  <div style={{ marginTop: '8px', fontSize: '0.6rem', opacity: 0.5, fontWeight: '800' }}>ANALYZE MACRO IMPACT ➔</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <header className="panel-header"><span>Enterprise Health Index</span></header>
          <div className="panel-content">
            {isLoading && !enterpriseData.Revenue ? (
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <div className="skeleton-circle skeleton" style={{ width: '80px', height: '80px', margin: '0 auto 16px' }}></div>
                <div className="skeleton-title skeleton" style={{ margin: '0 auto 8px', width: '40%' }}></div>
                <div className="skeleton-text skeleton" style={{ margin: '0 auto 16px', width: '80%' }}></div>
              </div>
            ) : (
              <>
                <div style={{ padding: '16px 20px', background: 'var(--bg-card)', borderRadius: '12px' }}>
                  <RadialHealthGauge score={healthScore} color={healthColor} status={healthStatus} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginTop: '16px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', borderLeft: `3px solid ${healthColor}` }}>
                    {getHealthDiagnostic()}
                  </p>
                  <EnterpriseMetricsVisualizer data={historicalMetrics} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bottom-row">
          <div className="panel">
            <header className="panel-header"><span>Live AI Reasoning Agents</span></header>
            <div className="panel-content scrollable">
              {isLoading && safeInsights.length === 0 ? (
                [1, 2, 3, 4].map(i => <div key={i} className="skeleton-text skeleton" style={{ margin: '12px 16px' }}></div>)
              ) : (
                safeInsights.map((insight) => (
                  <div key={insight.id} onClick={() => openSidebar(insight, 'agent')} className="list-item" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>
                     {insight.title}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <header className="panel-header"><span>Strategic Priority Matrix</span></header>
            <div className="panel-content">
              {[...allDecisions, ...safeRecommendations].slice(0, 4).map((rec) => (
                <div key={rec.id || rec.title} className="list-item" onClick={() => openSidebar(rec, 'recommendation')} style={{ cursor: 'pointer' }}>
                   {rec.title}
                </div>
              ))}
            </div>
          </div>
      </div>

      <MarketSimulator />

      {selectedItem && (
        <IntelligenceSidebar 
          item={selectedItem} 
          type={sidebarType} 
          onClose={closeSidebar} 
        />
      )}
    </div>
  );
};

export default OverviewDashboard;
