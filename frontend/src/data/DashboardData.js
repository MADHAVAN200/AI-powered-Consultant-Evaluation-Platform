export const globalEvents = [
  { id: 1, type: "RBI Policy", event: "Repo Rate Hike (+25 bps)", impact: "Borrowing costs to rise.", severity: "High" },
  { id: 2, type: "Market", event: "Oil prices ↑ 25% (Global)", impact: "Logistics inflation expected.", severity: "Critical" },
  { id: 3, type: "Economy", event: "Inflation ↑ 6.2%", impact: "Consumer demand pressure.", severity: "High" },
  { id: 4, type: "Currency", event: "₹ Depreciation (83.5/$)", impact: "Import costs to increase.", severity: "Medium" },
  { id: 5, type: "Competitor", event: "Reliance Retail Price Drop", impact: "Competitive margin pressure.", severity: "High" },
  { id: 6, type: "Supply Chain", event: "Red Sea Disruption", impact: "Shipping delays for exports.", severity: "Critical" },
  { id: 7, type: "Regulation", event: "New GST Council Update", impact: "Input credit compliance update.", severity: "Medium" },
  { id: 8, type: "Trade", event: "Import Restrictions (Duty ↑)", impact: "Raw material cost spike.", severity: "High" },
  { id: 9, type: "HR", event: "Tech Sector Layoffs", impact: "Talent acquisition cost drop.", severity: "Low" },
  { id: 10, type: "Market", event: "Consumer Demand ↓", impact: "Inventory buildup risk.", severity: "High" },
  { id: 11, type: "Logistics", event: "Port Congestion (JNPT)", impact: "Delivery lead times ↑ 3 days.", severity: "Medium" },
  { id: 12, type: "Energy", event: "Power Grid Shortage", impact: "Manufacturing output risk.", severity: "High" },
  { id: 13, type: "Labour", event: "Minimum Wage Revision", impact: "OpEx increase (+5%).", severity: "Medium" },
  { id: 14, type: "Materials", event: "Steel Prices ↑ 12%", impact: "Plant maintenance cost ↑.", severity: "High" },
  { id: 15, type: "Political", event: "Policy Uncertainty", impact: "Investor sentiment caution.", severity: "Medium" },
  { id: 16, type: "Trade", event: "India-UK FTA Signed", impact: "Export opportunities ↑.", severity: "Low" },
  { id: 17, type: "Finance", event: "Fuel Subsidy Review", impact: "Logistics cost volatility.", severity: "Medium" },
  { id: 18, type: "Logistics", event: "Highway Trucker Strike", impact: "Critical distribution delays.", severity: "Critical" },
  { id: 19, type: "Market", event: "Festive Demand Projection ↑", impact: "Stocking frequency increase.", severity: "Low" },
  { id: 20, type: "Environment", event: "Monsoon Floods (Mumbai)", impact: "Supply chain gridlock.", severity: "High" },
];

export const healthMetrics = [
  { name: "Revenue", value: "₹12.4 Cr", trend: "up" },
  { name: "Cost", value: "₹8.2 Cr", trend: "down" },
  { name: "Profit", value: "₹4.2 Cr", trend: "up" },
  { name: "Margin", value: "34%", trend: "up" },
  { name: "Attrition", value: "12%", trend: "down" },
  { name: "Customer Growth", value: "+5.2%", trend: "up" },
  { name: "Churn Rate", value: "4.1%", trend: "down" },
  { name: "Logistics Cost", value: "₹1.5 Cr", trend: "up" },
  { name: "Marketing Spend", value: "₹85 L", trend: "down" },
  { name: "Conversion Rate", value: "3.2%", trend: "up" },
  { name: "Inventory Turnover", value: "5.4x", trend: "neutral" },
  { name: "Debt", value: "₹1.2 Cr", trend: "down" },
  { name: "Cash Flow", value: "Positive", trend: "up" },
  { name: "Customer CSAT", value: "85/100", trend: "up" },
  { name: "Lead Time", value: "4.2 Days", trend: "down" },
  { name: "Supplier Dependency", value: "Medium", trend: "down" },
  { name: "Forecast Accuracy", value: "78%", trend: "up" },
  { name: "Productivity", value: "High", trend: "up" },
  { name: "Op. Efficiency", value: "82%", trend: "up" },
  { name: "Employees", value: "245", trend: "neutral" },
];

export const aiInsights = [
  { id: 1, title: "Rising Repo Rate impacting expansion capital.", why: "Current 6.5% rate is at a 4-year high, increasing the cost of floating rate corporate debt by 15-20 bps.", kpis: ["Debt", "Cash Flow"], confidence: 0.94 },
  { id: 2, title: "Logistics inflation detected via fuel spike.", why: "WPI for fuel has increased by 12% in the last 30 days, impacting long-haul distribution costs.", kpis: ["Logistics Cost", "Margin"], confidence: 0.88 },
  { id: 3, title: "GST Input Credit optimization potential (₹1.2L).", why: "Discrepancy found between GSTR-2B and purchase register for vendor 'Z'. Reconciliation will unlock immediate cash.", kpis: ["Cash Flow"], confidence: 0.96 },
  { id: 4, title: "Competitor pricing pressure in retail segment.", why: "Reliance Retail has dropped prices by 5% in North markets. AI predicts a 2% volume drop if we don't match.", kpis: ["Revenue", "Market Share"], confidence: 0.82 },
  { id: 5, title: "Supply chain gridlock risk (Mumbai Ports).", why: "Container turnaround time has increased from 4.2 days to 6.8 days due to recent labour strikes.", kpis: ["Lead Time", "Inventory"], confidence: 0.91 },
  { id: 6, title: "Margin compression risk detected (Cost ↑).", why: "Raw material COGS has increased by 8% while ASP remains stagnant. Breakeven point is shifting right.", kpis: ["Margin", "Profit"], confidence: 0.85 },
  { id: 7, title: "Attrition rate stabilizing in sales team.", why: "New incentive structure has reduced early-exit indicators (3-6 months) by 40%.", kpis: ["Attrition"], confidence: 0.78 },
  { id: 8, title: "Customer churn remains below industry average.", why: "High NPS (85) and successful loyalty retention campaigns are offsetting macro headwinds.", kpis: ["Churn Rate", "CSAT"], confidence: 0.95 },
  { id: 9, title: "Revenue growth slowing in B2B sector.", why: "Procurement cycles have extended from 45 to 70 days as clients conserve cash in a high-interest environment.", kpis: ["Revenue", "Lead Time"], confidence: 0.80 },
  { id: 10, title: "Inventory buildup risk in non-moving SKUs.", why: "SKU 'XT-4' has 180+ days of stock with no sales in the last 45 days. Obsolescence risk is high.", kpis: ["Inventory Turnover"], confidence: 0.93 }
];

export const topRecommendations = [
  { id: 1, decision: "Increase price by 2.5%", impact: "₹45L Profit ↑", risk: "Low", confidence: 0.88 },
  { id: 2, decision: "Optimize logistics Route-D", impact: "₹12L Cost ↓", risk: "Low", confidence: 0.92 },
  { id: 14, decision: "Cut low-margin SKU: XT-4", impact: "₹5L Loss ↓", risk: "Low", confidence: 0.90 },
  { id: 15, decision: "Focus on high-margin tiers", impact: "Margin focus", risk: "Med", confidence: 0.84 },
  { id: 18, decision: "Consolidate logistics frequency", impact: "₹4L Fuel ↓", risk: "Low", confidence: 0.91 },
  { id: 19, decision: "Update forecasting model", impact: "Accuracy ↑ 5%", risk: "Low", confidence: 0.89 },
];

export const detailedDecisions = [
  {
    id: 1, 
    title: "Increase Product Price by 2%", 
    impact: "₹45L Profit ↑", 
    risk: "Low", 
    confidence: 0.88,
    why: "Cost of raw materials has risen by 8%. Competitor pricing remains stable while consumer demand elasticity is moderate.",
    simulation: { best: "₹65L Profit (High retention)", exp: "₹45L Profit", worst: "₹12L Profit (Increased churn)" },
    dependency: "Price ↑ → Demand ↓ (Marginal) → Improved Unit Economics → Profit ↑"
  },
  {
    id: 2, 
    title: "Increase Product Price by 5%", 
    impact: "₹1.2 Cr Profit ↑", 
    risk: "High", 
    confidence: 0.62,
    why: "Significant OpEx pressure. Potential for high returns but risk of losing price-sensitive B2B customers.",
    simulation: { best: "₹1.8 Cr Profit", exp: "₹1.2 Cr Profit", worst: "₹30L Loss (High attrition)" },
    dependency: "Price ↑↑ → High Churn Risk → Revenue Volatility"
  },
  {
    id: 3, 
    title: "Bundle Core Products", 
    impact: "₹18L Volume ↑", 
    risk: "Low", 
    confidence: 0.92,
    why: "Cross-selling opportunities detected between Segment A and B. High synergy in logistics.",
    simulation: { best: "+25% Volume", exp: "+12% Volume", worst: "Stagnant growth" },
    dependency: "Bundling → Increased AOV → Improved Inventory Turn"
  },
  {
    id: 4, 
    title: "Strategy: Tactical Discounts", 
    impact: "₹30L Liquidated", 
    risk: "Med", 
    confidence: 0.84,
    why: "Identify non-moving inventory in North warehouse. Seasonal window closing.",
    simulation: { best: "Full liquidation", exp: "80% liquidation", worst: "Margin erosion" },
    dependency: "Discounts → Cash Flow ↑ → Storage Cost ↓"
  },
  {
    id: 5, 
    title: "Switch to Vendor 'B' (Steel)", 
    impact: "₹8L Month ↓", 
    risk: "Med", 
    confidence: 0.78,
    why: "Current supplier quality dipping. Vendor B offers 12% lower cost with slightly longer lead time.",
    simulation: { best: "₹12L Savings", exp: "₹8L Savings", worst: "Production delays" },
    dependency: "New Vendor → Lower COGS → Lead Time ↑"
  },
  {
    id: 6, 
    title: "Optimize Route-D (Logistics)", 
    impact: "₹4L Fuel ↓", 
    risk: "Low", 
    confidence: 0.96,
    why: "High redundancy in distribution frequency. Multi-drop optimization possible.",
    simulation: { best: "15% Fuel ↓", exp: "10% Fuel ↓", worst: "Missed ETAs" },
    dependency: "Route Opt. → Lower Fuel → Improved Green Score"
  },
  {
    id: 7, 
    title: "Outsource QA Operations", 
    impact: "₹25L OpEx ↓", 
    risk: "Med", 
    confidence: 0.82,
    why: "Fixed salary costs for QA are higher than tier-2 service agencies. Quality risk managed via SLA.",
    simulation: { best: "₹35L Savings", exp: "₹25L Savings", worst: "Quality drop" },
    dependency: "Outsource → Fixed Color ↓ → Variable Cost ↑"
  },
  {
    id: 8, 
    title: "Workforce Rightsizing (5%)", 
    impact: "₹65L Annual ↓", 
    risk: "High", 
    confidence: 0.70,
    why: "Overlapping roles in HR and Admin units. Shift to automation possible.",
    simulation: { best: "Leaner Op.", exp: "Immediate savings", worst: "Moral dip" },
    dependency: "Layoff → Immediate Save → Cultural Impact"
  },
  {
    id: 9, 
    title: "Initiate Hiring (10%) - R&D", 
    impact: "Growth Alpha", 
    risk: "Med", 
    confidence: 0.88,
    why: "New green energy project requires specialized talent. Market talent availability high now.",
    simulation: { best: "Innovation Lead", exp: "Faster launch", worst: "High burn" },
    dependency: "Hiring → IP Growth → Long-term Profit"
  },
  {
    id: 10, 
    title: "Expand to Tier-3 Markets", 
    impact: "₹2 Cr Pot. Rev", 
    risk: "High", 
    confidence: 0.65,
    why: "High demand detected via mobile search trends. Limited competitor presence currently.",
    simulation: { best: "Market Lead", exp: "Steady Growth", worst: "Low Adoption" },
    dependency: "Expansion → Distribution ↑ → Unit Economics Check"
  },
  {
    id: 11, 
    title: "Double Digital Marketing", 
    impact: "₹50L Sales ↑", 
    risk: "Med", 
    confidence: 0.80,
    why: "CAC (Customer Acquisition Cost) is currently at a 2-year low. Channel ROI is 4.5x.",
    simulation: { best: "6x ROI", exp: "4x ROI", worst: "Negative Brand equity" },
    dependency: "Marketing ↑ → CAC Check → Scalable Growth"
  },
  {
    id: 12, 
    title: "Reduce Performance Ads", 
    impact: "₹12L Savings", 
    risk: "Low", 
    confidence: 0.91,
    why: "Diminishing marginal returns on Facebook/Insta channels. Market saturation reached.",
    simulation: { best: "High ROAS", exp: "Leaner Spend", worst: "Volume Drop" },
    dependency: "Spend ↓ → Efficiency ↑ → Volume Check"
  },
  {
    id: 13, 
    title: "Focus: Premium Segment", 
    impact: "Margin ↑ 12%", 
    risk: "Med", 
    confidence: 0.85,
    why: "Premium customers show zero price sensitivity to recent spikes. Higher LTV detected.",
    simulation: { best: "Brand Lift", exp: "Margin ↑", worst: "Niche trap" },
    dependency: "Premium Focus → Brand Premium → Total Margin ↑"
  },
  {
    id: 14, 
    title: "Halt Low-Margin SKU XT-2", 
    impact: "₹5L Loss Avoided", 
    risk: "Low", 
    confidence: 0.94,
    why: "SKU constantly requires high rebates. Operational complexity not worth the revenue.",
    simulation: { best: "Leaner Store", exp: "Focus Shift", worst: "Lost Halo-effect" },
    dependency: "SKU Cut → Complexity ↓ → Higher Focus"
  },
  {
    id: 15, 
    title: "Implement RPA for Billing", 
    impact: "25% Efficiency ↑", 
    risk: "Low", 
    confidence: 0.97,
    why: "Manual invoicing cycle is 4.2 days. Automation can bring it to 0.5 days.",
    simulation: { best: "Instant Billing", exp: "20% Man-hours ↓", worst: "Tech debt" },
    dependency: "Automation → Speed ↑ → Errors ↓"
  },
  {
    id: 16, 
    title: "Delay Facility Expansion", 
    impact: "₹1.5 Cr CapEx Save", 
    risk: "Med", 
    confidence: 0.89,
    why: "Current interest rates make borrowing expensive. Utilization is at 78%, not 90%.",
    simulation: { best: "Better Interest", exp: "Cash Saved", worst: "Capacity Crunch" },
    dependency: "Delay → Debt Avoidance → Potential Gap"
  },
  {
    id: 17, 
    title: "Safety Stock Increase (20%)", 
    impact: "Reliability ↑", 
    risk: "High", 
    confidence: 0.72,
    why: "Red Sea shipping delays causing unpredictable arrivals. Buffer needed for festive rush.",
    simulation: { best: "No stockouts", exp: "Buffer safe", worst: "Captial stuck" },
    dependency: "Stock ↑ → Reliability ↑ → Cash Flow ↓"
  },
  {
    id: 18, 
    title: "Weekly delivery → Bi-weekly", 
    impact: "₹18L Logistics ↓", 
    risk: "Med", 
    confidence: 0.83,
    why: "Consolidation of orders reduces truck idle time. Clients informed of schedule change.",
    simulation: { best: "Max Efficiency", exp: "Cost ↓", worst: "Client Churn" },
    dependency: "Frequency ↓ → Vehicle Load ↑ → Lead Time ↑"
  },
  {
    id: 19, 
    title: "Renegotiate Vendor 'X'", 
    impact: "₹12L Benefit", 
    risk: "Med", 
    confidence: 0.76,
    why: "Vendor X has recently expanded capacity and needs volume commitment. Leverage window.",
    simulation: { best: "15% off", exp: "8% off", worst: "Vendor loss" },
    dependency: "Negotiation → Unit Cost ↓ → Margin ↑"
  },
  {
    id: 20, 
    title: "AI-Driven Warehouse Opt.", 
    impact: "18% Space Util ↑", 
    risk: "Low", 
    confidence: 0.95,
    why: "Current layout leads to internal congestion. AI heat-mapping suggests new zone allocation.",
    simulation: { best: "Faster Ops", exp: "Space Found", worst: "Initial Friction" },
    dependency: "Layout Opt. → Travel Time ↓ → Picking Speed ↑"
  }
];

export const simulationVariables = [
  { id: 1, name: "Headcount Increase", category: "Human Capital", unit: "%", min: 0, max: 50, default: 0 },
  { id: 2, name: "Headcount Reduction", category: "Human Capital", unit: "%", min: 0, max: 20, default: 0 },
  { id: 3, name: "Price Increase", category: "Market", unit: "%", min: 0, max: 25, default: 0 },
  { id: 4, name: "Price Decrease", category: "Market", unit: "%", min: 0, max: 25, default: 0 },
  { id: 5, name: "Digital Ad Spend", category: "Marketing", unit: "₹ L", min: 0, max: 50, default: 10 },
  { id: 6, name: "Brand Marketing ↓", category: "Marketing", unit: "%", min: 0, max: 50, default: 0 },
  { id: 7, name: "Logistics Budget ↑", category: "Supply Chain", unit: "%", min: 0, max: 30, default: 0 },
  { id: 8, name: "Fuel Efficiency ↑", category: "Supply Chain", unit: "%", min: 0, max: 15, default: 0 },
  { id: 9, name: "Market Demand ↑", category: "External", unit: "%", min: 0, max: 40, default: 0 },
  { id: 10, name: "Market Demand ↓", category: "External", unit: "%", min: 0, max: 40, default: 0 },
  { id: 11, name: "Production Shifts ↑", category: "Operations", unit: "Shifts", min: 1, max: 3, default: 1 },
  { id: 12, name: "Machine Downtime ↓", category: "Operations", unit: "%", min: 0, max: 20, default: 5 },
  { id: 13, name: "New Tier-1 Supplier", category: "Supply Chain", unit: "Count", min: 0, max: 5, default: 0 },
  { id: 14, name: "Supplier Consolidation", category: "Supply Chain", unit: "%", min: 0, max: 30, default: 0 },
  { id: 15, name: "Inventory Buffer ↑", category: "Supply Chain", unit: "Days", min: 0, max: 30, default: 5 },
  { id: 16, name: "Safety Stock ↓", category: "Supply Chain", unit: "%", min: 0, max: 20, default: 0 },
  { id: 17, name: "Employee Wages ↑", category: "Human Capital", unit: "%", min: 0, max: 20, default: 0 },
  { id: 18, name: "Operational OpEx ↓", category: "Operations", unit: "%", min: 0, max: 15, default: 0 },
  { id: 19, name: "Inflation Shock (INR)", category: "External", unit: "%", min: 0, max: 12, default: 4 },
  { id: 20, name: "Competitor Price Hike", category: "Market", unit: "%", min: 0, max: 15, default: 0 },
];

export const simulationKPIs = [
  { id: 1, name: "Total Revenue", base: "₹12.4 Cr", category: "Financial" },
  { id: 2, name: "Operating Cost", base: "₹8.2 Cr", category: "Financial" },
  { id: 3, name: "Net Profit", base: "₹4.2 Cr", category: "Financial" },
  { id: 4, name: "Gross Margin", base: "33.8%", category: "Financial" },
  { id: 5, name: "Customer Growth", base: "+5.2%", category: "Market" },
  { id: 6, name: "Customer Churn", base: "4.1%", category: "Market" },
  { id: 7, name: "Market Demand", base: "High", category: "Market" },
  { id: 8, name: "Supply Efficiency", base: "82%", category: "Supply Chain" },
  { id: 9, name: "Inventory Value", base: "₹3.5 Cr", category: "Supply Chain" },
  { id: 10, name: "Average Lead Time", base: "4.2 Days", category: "Supply Chain" },
  { id: 11, name: "Eemp Productivity", base: "88%", category: "Human Capital" },
  { id: 12, name: "Monthly Attrition", base: "1.2%", category: "Human Capital" },
  { id: 13, name: "Marketing ROI", base: "4.5x", category: "Marketing" },
  { id: 14, name: "Monthly Cash Flow", base: "₹85L", category: "Financial" },
  { id: 15, name: "Debt-to-Equity", base: "0.24", category: "Financial" },
  { id: 16, name: "Monthly Burn Rate", base: "₹15L", category: "Financial" },
  { id: 17, name: "Op. Efficiency", base: "78%", category: "Operations" },
  { id: 18, name: "Supplier Risk Baro", base: "Low", category: "Supply Chain" },
  { id: 19, name: "Delivery Window", base: "94%", category: "Operations" },
  { id: 20, name: "Forecast Accuracy", base: "70%", category: "Intelligence" },
];

export const dataSources = [
  { id: 1, name: "SAP ERP", type: "System", status: "Synced", health: 98, lastSync: "2m ago" },
  { id: 2, name: "Tally Prime", type: "Accounting", status: "Synced", health: 94, lastSync: "1h ago" },
  { id: 3, name: "Salesforce CRM", type: "Sales", status: "Syncing", health: 88, lastSync: "Now" },
  { id: 4, name: "Darwinbox HRM", type: "HR", status: "Synced", health: 92, lastSync: "4h ago" },
  { id: 5, name: "Razorpay PG", type: "Payments", status: "Synced", health: 99, lastSync: "5m ago" },
  { id: 6, name: "Zendesk", type: "Support", status: "Synced", health: 95, lastSync: "10m ago" },
  { id: 7, name: "Shopify Store", type: "E-comm", status: "Synced", health: 91, lastSync: "15m ago" },
  { id: 8, name: "AWS S3 Cloud", type: "Storage", status: "Connected", health: 100, lastSync: "12h ago" },
  { id: 9, name: "Custom SQL DB", type: "Database", status: "Failed", health: 45, lastSync: "6h ago" },
  { id: 10, name: "Zoho Marketing", type: "Marketing", status: "Synced", health: 89, lastSync: "2h ago" },
  { id: 11, name: "Delhivery API", type: "Logistics", status: "Synced", health: 87, lastSync: "30m ago" },
  { id: 12, name: "Excel Uploads", type: "Manual", status: "Ready", health: 82, lastSync: "1d ago" },
  { id: 13, name: "CSV Master Data", type: "Manual", status: "Ready", health: 78, lastSync: "3d ago" },
  { id: 14, name: "IoT Factory Sensors", type: "Hardware", status: "Syncing", health: 96, lastSync: "Now" },
  { id: 15, name: "RBI Rate API", type: "External", status: "Synced", health: 100, lastSync: "1h ago" },
  { id: 16, name: "GST Portal Sync", type: "Gov", status: "Synced", health: 93, lastSync: "1d ago" },
  { id: 17, name: "PowerBI Connect", type: "BI", status: "Connected", health: 97, lastSync: "5h ago" },
  { id: 18, name: "Slack Alerts", type: "Comm", status: "Connected", health: 100, lastSync: "8h ago" },
  { id: 19, name: "Google Analytics", type: "Web", status: "Synced", health: 85, lastSync: "2h ago" },
  { id: 20, name: "Legacy Mainframe", type: "System", status: "Syncing", health: 62, lastSync: "Now" },
];

export const dataHealthMetrics = [
  { id: 1, name: "Last Global Sync", value: "02:14:08", status: "Normal" },
  { id: 2, name: "Missing Values %", value: "1.2%", status: "Good" },
  { id: 3, name: "Data Freshness", value: "98.5%", status: "Good" },
  { id: 4, name: "Error Rate", value: "0.04%", status: "Normal" },
  { id: 5, name: "Schema Consistency", value: "99.2%", status: "Good" },
  { id: 6, name: "API Latency", value: "145ms", status: "Good" },
  { id: 7, name: "Data Completeness", value: "97.8%", status: "Normal" },
  { id: 8, name: "Duplication Rate", value: "0.2%", status: "Good" },
  { id: 9, name: "Accuracy Score", value: "96.4%", status: "Normal" },
  { id: 10, name: "Integration Uptime", value: "99.98%", status: "Good" },
  { id: 11, name: "API Health Status", value: "Healthy", status: "Good" },
  { id: 12, name: "Upload Frequency", value: "High", status: "Good" },
  { id: 13, name: "Data Drift Detected", value: "None", status: "Good" },
  { id: 14, name: "Anomaly Notifications", value: "2", status: "Normal" },
  { id: 15, name: "Outlier Count", value: "14", status: "Normal" },
  { id: 16, name: "Schema Mismatches", value: "0", status: "Good" },
  { id: 17, name: "Connection Failures", value: "1", status: "Normal" },
  { id: 18, name: "Sync Lag Time", value: "1.2s", status: "Good" },
  { id: 19, name: "Validation Errors", value: "8", status: "Normal" },
  { id: 20, name: "Data Confidence Score", value: "94/100", status: "Good" },
];

export const decisionHistory = [
  { 
    id: 1, action: "Price Increase (2%)", outcome: "Success", impact: "+₹45L Profit", date: "2024-03-28", 
    recommendedAction: "Increase price by 5% for premium segment.",
    actualAction: "Increase price by 2% globally.",
    alignment: "Partial",
    why: "Organization opted for a conservative 2% global hike instead of the agent's 5% premium-only suggeston. While profitable, the agent noted missed margin potential in high-loyalty tiers.", 
    factors: ["Retention: 96%", "Competitor Price: Stable"], 
    learnings: "Agent learned to weigh human 'Risk Aversion' scores; now recommending graduated price shifts instead of aggressive single-step jumps." 
  },
  { 
    id: 2, action: "Supplier Switch (Steel)", outcome: "Neutral", impact: "0% Change", date: "2024-03-25", 
    recommendedAction: "Switch to Vendor 'X' for 30% cost reduction.",
    actualAction: "Partial switch (15%) to Vendor 'X'.",
    alignment: "Partial",
    why: "Organization split the supply to mitigate risk. Savings matched the AI's calculation for 15%, but the split increased logistical overhead.", 
    factors: ["Cost: -12%", "QA Rejections: +18%"], 
    learnings: "Adjusted 'Multi-Vendor Overhead' penalty in the procurement model; agent now prioritizes single-source for non-critical raw materials." 
  },
  { 
    id: 3, action: "Hiring Freeze (Admin)", outcome: "Positive", impact: "-₹12L OpEx", date: "2024-03-20", 
    recommendedAction: "100% Freeze on all back-office hiring.",
    actualAction: "100% Freeze on Admin and HR hiring.",
    alignment: "Full",
    why: "Full alignment followed. Agent successfully predicted that automated invoicing would handle the resulting workload gap.", 
    factors: ["Payroll: -15%", "Efficiency: High"], 
    learnings: "Confirmed 'Automation Capacity' multiplier for HR/Admin functions in mature digital environments." 
  },
  { 
    id: 4, action: "Marketing Spend ↑ (20%)", outcome: "Negative", impact: "-₹8L ROI", date: "2024-03-15", 
    recommendedAction: "Cap budget increase at 10% for Meta/Google.",
    actualAction: "Approved 20% increase across all digital channels.",
    alignment: "Deviation",
    why: "Organization overspent the AI's 10% recommendation by double. The extra 10% hit diminishing returns immediately, leading to a negative ROI.", 
    factors: ["CAC Spike: +43%", "Conversion: Stagnant"], 
    learnings: "Agent learned that organizational 'Aggression' spikes during festive quarters leads to non-linear CAC escalations. Updated saturation caps accordingly." 
  },
  { 
    id: 5, action: "Discount Campaign", outcome: "Mixed", impact: "+Vol / -Margin", date: "2024-03-10", 
    recommendedAction: "15% Discount on SKU XT-2 only.",
    actualAction: "25% sitewide clearance sale.",
    alignment: "Deviation",
    why: "Organization ran a broader sale than suggested. This cleared inventory but eroded the margin of high-margin premium products un-intended by the model.", 
    factors: ["Liquidity: +₹30L", "Margin Erosion: 8%"], 
    learnings: "Added 'Global Burn' penalty to sitewide discount recommendations; agent learned to suggest 'Flash' time-limits instead of flat % drops." 
  },
  { 
    id: 6, action: "Warehouse Automation", outcome: "Positive", impact: "+18% Speed", date: "2024-03-05", 
    recommendedAction: "Install 4 AGVs in Central Hub.",
    actualAction: "Install 4 AGVs in Central Hub.",
    alignment: "Full",
    why: "Full alignment. The installation in Zone-D successfully eliminated travel-time redundancy as predicted.", 
    factors: ["Picking Speed: +22%", "Accuracy: 99.8%"], 
    learnings: "Verified 'Spatial-Efficiency' weights for robotics; model now prioritizes travel-distance reduction over picking-speed raw metrics." 
  },
  { 
    id: 7, action: "Expansion (Tier-3)", outcome: "Failed", impact: "-₹25L CapEx", date: "2024-02-28", 
    recommendedAction: "Delay expansion by 2 quarters.",
    actualAction: "Immediate Q1 launch to meet investor targets.",
    alignment: "Deviation",
    why: "The agent warned of low smartphone penetration maturity. The organization's early launch resulted in high setup costs without the digital adoption scale.", 
    factors: ["Adoption: 12%", "Setup Cost: High"], 
    learnings: "Agent learned to include 'External Stakeholder Pressure' as a noise factor; updated 'Readiness' threshold to be non-negotiable for approval." 
  },
  { 
    id: 8, action: "OpEx Reduction Plan", outcome: "Success", impact: "+₹30L Cash", date: "2024-02-20", 
    recommendedAction: "Consolidate to Top-3 vendors for shipping.",
    actualAction: "Consolidate to Top-3 vendors for shipping.",
    alignment: "Full",
    why: "Full alignment followed. Bulk-rate negotiation achieved exactly the 14% reduction the agent forecasted.", 
    factors: ["Logistics Save: 14%", "Vendors: 12 → 3"], 
    learnings: "Hardened 'Logistics Concentration' as a primary profitable strategy in our core sectors." 
  },
  { 
    id: 9, action: "Inventory Buffer ↑", outcome: "Negative", impact: "Capital Stuck", date: "2024-02-15", 
    recommendedAction: "Maintain current buffer, do not increase.",
    actualAction: "Increased buffer by 15% due to sourcing concerns.",
    alignment: "Deviation",
    why: "Human supply-chain leads over-rode the agent's 'Steady' advice. Unseasonal rainfall then killed the demand, leaving capital trapped in sitting stock.", 
    factors: ["Aging Stock: +₹45L", "DSO: +8 days"], 
    learnings: "Agent learned that 'Sourcing Fear' leads to over-stocking. Created a 'Fear vs Demand' delta check in predictive modelling." 
  },
  { 
    id: 10, action: "Product Bundling", outcome: "Positive", impact: "+12% AOV", date: "2024-02-10", 
    recommendedAction: "Bundle Product A with B (10% discount).",
    actualAction: "Bundle Product A with B (10% discount).",
    alignment: "Full",
    why: "Full alignment. The complementarity of the set drove 35% adoption, exactly within the 32-38% agent confidence range.", 
    factors: ["AOV: +12%", "User Opt-in: 35%"], 
    learnings: "Refined 'Co-Purchase probability' logic; verified that 10% is the psychological sweet-spot for bundle adoption." 
  },
  { 
    id: 11, action: "Logistics Optimization", outcome: "Success", impact: "-15% Fuel", date: "2024-02-05", 
    recommendedAction: "Switch to AI Dynamic Routing.",
    actualAction: "Switch to AI Dynamic Routing.",
    alignment: "Full",
    why: "Full alignment. Routes were optimized daily, reducing empty-haulage by 500km/week across the fleet.", 
    factors: ["Fuel Save: 15%", "Idle Time: -22%"], 
    learnings: "Confirmed 'Dynamic Variability' as a high-reward strategy for fuel-sensitive operations." 
  },
  { 
    id: 12, action: "Workforce Rightsizing", outcome: "Neutral", impact: "Minimal Save", date: "2024-01-28", 
    recommendedAction: "Target 8% reduction in over-staffed units.",
    actualAction: "3% reduction in all units.",
    alignment: "Partial",
    why: "Organization flattened the reduction to avoid morale issues. While safer, it didn't solve the core over-staffing in Unit-D, leading to severance-offset neutral performance.", 
    factors: ["Salary Save: ₹5L", "Severance: ₹4.8L"], 
    learnings: "Agent learned that 'Broad Equality' policies dilute efficiency gains. Now recommends 'Skill-Gapping' instead of 'Headcount' raw cuts." 
  },
  { 
    id: 13, action: "Dynamic Pricing (Festive)", outcome: "Success", impact: "+₹1.2 Cr Rev", date: "2024-01-20", 
    recommendedAction: "Adjust pricing every 30 mins.",
    actualAction: "Adjust pricing every 60 mins.",
    alignment: "Partial",
    why: "Organization throttled updates to hourly to maintain site stability. Success was achieved, but the AI noted 5% missed revenue due to slower reaction speed.", 
    factors: ["Peak Margin: +18%", "Volume: Stable"], 
    learnings: "Integrated 'Latency-Miss' metric; agent learned to recommend higher price deltas when update frequency is limited by tech." 
  },
  { 
    id: 14, action: "Vendor Diversification", outcome: "Positive", impact: "Risk ↓", date: "2024-01-15", 
    recommendedAction: "Add 2 secondary vendors by end of Q4.",
    actualAction: "Added 2 secondary vendors by end of Q4.",
    alignment: "Full",
    why: "Full alignment. This decision proved critical during the January strike, allowing production to continue at 80% capacity.", 
    factors: ["Downtime Avoided: 4 days", "Supplier Health: 92%"], 
    learnings: "Validated 'Redundancy ROI' model; agent learned that production uptime carries a 3x higher weight than per-unit cost savings." 
  },
  { 
    id: 15, action: "Performance Ads Cut", outcome: "Negative", impact: "Lead Drop", date: "2024-01-10", 
    recommendedAction: "Maintain spend, only optimize creative.",
    actualAction: "Cut spend by 50% to save cash.",
    alignment: "Deviation",
    why: "The organization cut the budget despite the AI's warning. The lead flow dropped by 30%, which ultimately cost more in missed LTV than the cash saved.", 
    factors: ["Lead AttRib: -30%", "Organic Flow: Down"], 
    learnings: "Agent learned that 'Short-Term Cash Preservation' fear leads to 'Long-Term Growth Decay'. Strengthened the LTV prediction visibility." 
  },
  { 
    id: 16, action: "Packing Unit Efficiency", outcome: "Positive", impact: "+25% Output", date: "2024-01-05", 
    recommendedAction: "Invert Zone-A layout for 12m travel win.",
    actualAction: "Invert Zone-A layout for 12m travel win.",
    alignment: "Full",
    why: "Full alignment. Redesign of conveyor belt successfully reduced travel as predicted, increasing total output capacity.", 
    factors: ["Output: +25%", "Error Rate: -2%"], 
    learnings: "Confirmed 'Travel Distance' as the primary bottleneck in low-automation units." 
  },
  { 
    id: 17, name: "Demand Prediction (v2)", outcome: "Improved", impact: "+5% Accuracy", date: "2023-12-28", 
    recommendedAction: "Upgrade to Version 2.0 (Social-Weighted).",
    actualAction: "Upgrade to Version 2.0 (Social-Weighted).",
    alignment: "Full",
    why: "Full alignment. Version 2.0 significantly reduced Q4 noise through sentiment analysis as projected.", 
    factors: ["MAE: -3.2%", "Sentiment Focus: High"], 
    learnings: "Verified 'Social Influence' as a leading indicator for B2C consumer electronics demand." 
  },
  { 
    id: 18, action: "Risk Mitigation (FX)", outcome: "Successful", impact: "Hedge Gain", date: "2023-12-20", 
    recommendedAction: "Hedge 75% of exposure.",
    actualAction: "Hedged 40% of exposure.",
    alignment: "Partial",
    why: "Organization stayed conservative on hedging. While 40% gave a gain, the agent missed an additional ₹20L gain that the 75% hedge would have provided.", 
    factors: ["Loss Avoided: ₹15L", "Hedging: 40% Coverage"], 
    learnings: "Adjusted 'Trust Threshold' for FX recommendations; agent now provides tiered hedging ranges (Conservative/Moderate/AI-Optimal)." 
  },
  { 
    id: 19, action: "CapEx Control", outcome: "Stable", impact: "Debt ↓", date: "2023-12-15", 
    recommendedAction: "Freeze all new CapEx for 12 weeks.",
    actualAction: "Freeze all new CapEx for 12 weeks.",
    alignment: "Full",
    why: "Full alignment. Debt-to-Equity improved by 0.05 points, stabilizing the balance sheet during the high-interest period.", 
    factors: ["Debt-to-Equity: 0.22", "Interest Save: ₹4L"], 
    learnings: "Validated 'Liquidity Preservation' as the best tactic in 'Interest-Rising' economic clusters." 
  },
  { 
    id: 20, action: "Agile Strategy Shift", outcome: "Positive", impact: "Adaptability ↑", date: "2023-12-10", 
    recommendedAction: "Move to 7-day strategy review loops.",
    actualAction: "Move to 7-day strategy review loops.",
    alignment: "Full",
    why: "Full alignment. The weekly cadence proved critical in pivoting the logistics chain before the crisis peaked.", 
    factors: ["Pivot Speed: 2 days", "Information Flow: High"], 
    learnings: "Verified 'Frequency Alpha'—more frequent re-calibration beats precise but slow planning in high-volatility years." 
  },
];

export const modelMetrics = [
  { id: 1, name: "Model Accuracy", value: "94.2%", trend: "+1.2%" },
  { id: 2, name: "Avg. Confidence", value: "88.5%", trend: "+0.5%" },
  { id: 3, name: "Reward Score", value: "4,250", trend: "+240" },
  { id: 4, name: "Learning Rate", value: "0.0012", trend: "Stable" },
  { id: 5, name: "Decision Success Rate", value: "72%", trend: "+4%" },
  { id: 6, name: "Model Failure Rate", value: "4%", trend: "-1%" },
  { id: 7, name: "Prediction Accuracy", value: "91%", trend: "+2%" },
  { id: 8, name: "Risk Prediction Acc.", value: "86%", trend: "+3%" },
  { id: 9, name: "Scenario Simulation Acc.", value: "82%", trend: "+5%" },
  { id: 10, name: "Adaptability Score", value: "84/100", trend: "High" },
  { id: 11, name: "Avg. Response Time", value: "1.2s", trend: "-0.2s" },
  { id: 12, name: "Knowledge Coverage", value: "96%", trend: "+1%" },
  { id: 13, name: "Model Drift Index", value: "Low", trend: "Good" },
  { id: 14, name: "Model Stability", value: "98%", trend: "Stable" },
  { id: 15, name: "Trend Detection Acc.", value: "89%", trend: "+4%" },
  { id: 16, name: "Anomaly Detection Rate", value: "95%", trend: "Good" },
  { id: 17, name: "Explainability Score", value: "92/100", trend: "High" },
  { id: 18, name: "User Trust Score", value: "96/100", trend: "+2%" },
  { id: 19, name: "Decision Consistency", value: "94%", trend: "Stable" },
  { id: 20, name: "Perf. Improvement %", value: "18%", trend: "Peak" },
];

export const strategyInsights = {
  best: ["Product Bundling", "Cost Optimization", "Supplier Diversification", "Dynamic Pricing"],
  weak: ["Aggressive Price Hike (>10%)", "Facility Over-Expansion", "Marketing Spend Over-Scale"]
};

export const localCompanyEvents = [
  { id: 1, type: "ERP Sync", event: "SAP Master Data Sync", outcome: "Complete", timestamp: "5m ago" },
  { id: 2, type: "Inventory", event: "New SKU detected (TX-90)", outcome: "Cataloged", timestamp: "12m ago" },
  { id: 3, type: "Salesforce", event: "Lead duplication audit", outcome: "1.2k Merged", timestamp: "45m ago" },
  { id: 4, type: "Finance", event: "Q2 Tax provision recalculation", outcome: "Verified", timestamp: "1h ago" },
  { id: 5, type: "Logistics", event: "Warehouse-D layout heatmap", outcome: "Optimized", timestamp: "2h ago" },
  { id: 6, type: "E-comm", event: "Shopify API Webhook shift", outcome: "Active", timestamp: "3h ago" },
  { id: 7, type: "HR", event: "Darwinbox payroll run start", outcome: "In-Progress", timestamp: "4h ago" },
  { id: 8, type: "Security", event: "Database access audit (AWS)", outcome: "Secure", timestamp: "5h ago" },
  { id: 9, type: "Manual", event: "Excel upload (Logistics_Q2.v4)", outcome: "Parsed", timestamp: "6h ago" },
  { id: 10, type: "Hardware", event: "Factory-4 sensor calibration", outcome: "Ready", timestamp: "8h ago" },
  { id: 11, type: "Payments", event: "Razorpay reconciliation run", outcome: "Matched", timestamp: "12h ago" },
  { id: 12, type: "Support", event: "Zendesk sentiment baseline", outcome: "Updated", timestamp: "1d ago" },
];
