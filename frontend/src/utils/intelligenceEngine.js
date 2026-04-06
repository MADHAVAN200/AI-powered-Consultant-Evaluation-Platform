/**
 * Intelligence Engine (Mock)
 * Analyzes enterprise datasets and global market signals to derive insights and recommendations.
 */

export const analyzeData = (metrics, globalSignals) => {
  const insights = [];
  const recommendations = [];

  // 1. ANOMALY DETECTION
  if (metrics.Margin < 0) {
    insights.push({
      id: 'critical-margin',
      title: "Negative margin detected (System Leak)",
      why: "Operating costs currently exceed gross revenue. Breakeven threshold is breached.",
      confidence: 0.98,
      type: 'critical'
    });
    recommendations.push({
      id: 'rec-cost-cut',
      title: "Aggressive OpEx reduction (15%)",
      impact: "Restore profitability",
      risk: "High",
      confidence: 0.92,
      why: "Operating costs currently exceed gross revenue. Immediate cost cutting is required to stabilize the cash burn.",
      simulation: { best: "₹15L Profit", exp: "₹2L Profit", worst: "₹10L Loss" },
      dependency: "Cost Cut → Lower Burn → Improved Runway"
    });
  }

  if (metrics.LogisticsCost > metrics.Revenue * 0.2) {
    insights.push({
      id: 'logistics-spike',
      title: "Logistics over-index identified",
      why: "Logistics spend is 20%+ of revenue, significantly above the 8% industry baseline.",
      confidence: 0.89,
      type: 'warning'
    });
  }

  // 2. MACRO IMPACT MAPPING
  const activeOilSignal = globalSignals.find(s => s.id === 'oil-spike');
  if (activeOilSignal && metrics.LogisticsCost > 0) {
    insights.push({
      id: 'oil-impact',
      title: "Fuel inflation affecting distribution",
      why: `The active ${activeOilSignal.event} is projected to add 5-8% to your current Logistics spend.`,
      confidence: 0.94,
      type: 'signal'
    });
    recommendations.push({
        id: 'rec-logistics-opt',
        title: "Optimize Route-D (Logistics)",
        impact: "₹12L Cost ↓",
        risk: "Low",
        confidence: 0.95,
        why: "Fuel prices are rising. Optimizing distribution routes will reduce empty-haulage and fuel burn.",
        simulation: { best: "₹20L Save", exp: "₹12L Save", worst: "₹2L Save" },
        dependency: "Route Opt. → Fuel Efficiency → Margin Buffer"
    });
  }

  const activeMarketSignal = globalSignals.find(s => s.id === 'market-crash');
  if (activeMarketSignal) {
    insights.push({
      id: 'market-risk',
      title: "Liquidity preservation required",
      why: "High market volatility detected. Consumer demand elasticity is expected to tighten.",
      confidence: 0.96,
      type: 'critical'
    });
    recommendations.push({
        id: 'rec-cap-freeze',
        title: "Freeze all new CapEx",
        impact: "Preserve Cash",
        risk: "Med",
        confidence: 0.91,
        why: "Market volatility is high. Conserving cash now will provide the necessary buffer for upcoming macro shocks.",
        simulation: { best: "Capital Protected", exp: "Cash Buffer ↑", worst: "Marginal Safety" },
        dependency: "Freeze → Lower Debt → Higher Resilience"
    });
  }

  // 3. GROWTH SIGNALS
  if (metrics.Revenue > 14000000 && metrics.ChurnRate < 3) {
    insights.push({
      id: 'growth-alpha',
      title: "Organic growth momentum",
      why: "Revenue and retention metrics indicate a strong product-market fit. Ready for scale.",
      confidence: 0.91,
      type: 'success'
    });
    recommendations.push({
        id: 'rec-expand-tier1',
        title: "Expand to Tier-1 Markets",
        impact: "₹3 Cr Rev ↑",
        risk: "Med",
        confidence: 0.88,
        why: "Internal metrics show strong organic expansion potential. Tier-1 markets offer high LTV customers.",
        simulation: { best: "₹5 Cr Rev", exp: "₹3 Cr Rev", worst: "₹1 Cr Rev" },
        dependency: "Expansion → Brand Alpha → Future Profit"
    });
  }

  // Fallback insights if nothing specific is found
  if (insights.length === 0) {
    insights.push({
      id: 'baseline',
      title: "Operating within stable parameters",
      why: "No significant anomalies or macro-threats detected in the current sync period.",
      confidence: 0.85,
      type: 'info'
    });
  }

  return { insights, recommendations };
};
