/**
 * Intelligence Engine (Mock)
 * Analyzes enterprise datasets and global market signals to derive insights and recommendations.
 */

export const analyzeData = (metrics, globalSignals) => {
  const insights = [];
  const recommendations = [];

  // 0. DATA PRESENCE CHECK
  if (!metrics || metrics.Revenue === 0) {
    return {
      insights: [{
        id: 'no-data',
        title: "Waiting for Data Ingestion",
        why: "Connect a data source or upload a CSV to begin real-time enterprise analysis.",
        confidence: 1.0,
        type: 'info'
      }],
      recommendations: [{
        id: 'rec-ingest',
        title: "Ingest Enterprise Dataset",
        impact: "Unlock Intelligence",
        risk: "Low",
        confidence: 1.0,
        why: "System is in a ready state. Uploading a dataset will trigger the Alpha-Reasoning engine.",
        simulation: { best: "Full Visibility", exp: "Strategic Insights", worst: "No Change" },
        dependency: "Upload → Sync → Analyze"
      }]
    };
  }

  // 1. ANOMALY DETECTION
  if (metrics.Margin < 15 && metrics.Margin > 0) {
    insights.push({
      id: 'low-margin',
      title: "Compressed profit margins detected",
      why: "Current margin is below the 18% industry threshold for this sector.",
      confidence: 0.92,
      type: 'warning'
    });
  } else if (metrics.Margin <= 0) {
    insights.push({
      id: 'critical-margin',
      title: "Negative margin / Burn detected",
      why: "Operating costs exceed gross revenue. Immediate liquidity check required.",
      confidence: 0.98,
      type: 'critical'
    });
  }

  // 2. DYNAMIC SIGNAL ANALYSIS
  globalSignals.forEach(signal => {
    if (signal.severity === 'High' || signal.severity === 'Critical') {
      insights.push({
        id: `sig-${signal.id}`,
        title: `Macro Risk: ${signal.type || 'Global'}`,
        why: `The ${signal.event} signal is classified as ${signal.severity} Impact. Monitoring for correlation with your ${signal.type?.toLowerCase() || 'operating'} costs.`,
        confidence: 0.85,
        type: 'signal'
      });

      // Dynamic recommendation based on signal type
      if (signal.type?.toLowerCase().includes('policy') || signal.type?.toLowerCase().includes('tax')) {
          recommendations.push({
              id: `rec-policy-${signal.id}`,
              title: "Compliance Audit & Hedge",
              impact: "Risk Mitigation",
              risk: "Low",
              confidence: 0.88,
              why: "Policy shifts require immediate re-assessment of tax liability and contractual obligations.",
              simulation: { best: "Zero Leakage", exp: "5% Save", worst: "12% Exposure" },
              dependency: "Legal Review → Financial Planning"
          });
      }
    }
  });

  // 3. PERFORMANCE SIGNALS
  if (metrics.ChurnRate > 8) {
    insights.push({
      id: 'churn-surge',
      title: "Customer attrition above baseline",
      why: `Churn is at ${metrics.ChurnRate}%, significantly higher than the 5% target.`,
      confidence: 0.94,
      type: 'critical'
    });
    recommendations.push({
        id: 'rec-churn-mitigation',
        title: "Customer Retention Sprint",
        impact: "Revenue Stability",
        risk: "Med",
        confidence: 0.91,
        why: "High churn is the primary threat to LTV. Improving the onboarding flow and support response times will stabilize this.",
        simulation: { best: "₹50L Saved", exp: "₹20L Saved", worst: "₹5L Saved" },
        dependency: "Product UX → Customer Success"
    });
  }

  // Fallback insights if nothing specific is found
  if (insights.length === 0) {
    insights.push({
      id: 'baseline',
      title: "Stable Operating State",
      why: "No significant anomalies or high-impact macro threats detected in the current sync window.",
      confidence: 0.85,
      type: 'success'
    });
  }

  return { insights, recommendations };
};
