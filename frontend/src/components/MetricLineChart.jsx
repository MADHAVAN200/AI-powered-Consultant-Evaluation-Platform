import React from 'react';

const formatAxisTickValue = (value, unit) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    if (unit === 'percent') return `${n.toFixed(0)}%`;
    if (unit === 'ratio') return `${n.toFixed(1)}x`;
    if (unit === 'days') return `${n.toFixed(1)}d`;
    if (unit === 'inr_cr') return `${n.toFixed(2)}Cr`;
    if (unit === 'inr_lakh') return `${n.toFixed(1)}L`;
    if (unit === 'inr') return `${Math.round(n / 1000)}k`;
    return Number.isInteger(n) ? `${n}` : n.toFixed(1);
};

const MetricChart = ({ label, values = [], xLabels = [], unit = 'count', type = 'line', color = '#58a6ff' }) => {
    const nums = values.map(Number).filter(Number.isFinite);
    if (nums.length < 2 && type === 'line') return null;
    if (nums.length < 1 && type === 'bar') return null;

    const width = 400;
    const height = 230;
    const leftPad = 48;
    const rightPad = 20;
    const topPad = 20;
    const bottomPad = 52;
    const plotW = width - leftPad - rightPad;
    const plotH = height - topPad - bottomPad;

    const min = Math.min(...nums, 0); // Always include 0 for bar charts
    const max = Math.max(...nums, 1);
    const span = Math.max(1, max - min);
    const yMin = type === 'bar' ? 0 : min - span * 0.1;
    const yMax = max + span * 0.1;

    const xAt = (i) => leftPad + (i * plotW) / Math.max(1, nums.length - (type === 'line' ? 1 : 0));
    const yAt = (v) => topPad + ((yMax - v) * plotH) / Math.max(0.0001, yMax - yMin);

    // Line Chart Specifics
    const points = nums.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');
    const areaPoints = `${points} ${xAt(nums.length - 1)},${topPad + plotH} ${xAt(0)},${topPad + plotH}`;

    // Bar Chart Specifics
    const barWidth = Math.min(40, (plotW / nums.length) * 0.7);

    const yTicks = 4;
    const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks);

    const chartId = label.toLowerCase().replace(/[^a-z0-9]/g, '-');

    return (
        <article className="premium-chart-card">
            <div className="chart-header">
                <div className="chart-title-group">
                    <span className="chart-type-tag" style={{ color: color, background: `${color}15` }}>{type}</span>
                    <h4>{label}</h4>
                </div>
                <span className="chart-unit-tag">{unit.replace('_', ' ')}</span>
            </div>
            <div className="chart-body">
                <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
                    <defs>
                        <linearGradient id={`grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    {tickValues.map((t, idx) => {
                        const y = yAt(t);
                        return (
                            <g key={idx}>
                                <line x1={leftPad} y1={y} x2={leftPad + plotW} y2={y} stroke="var(--border-light)" strokeDasharray="3,3" opacity="0.3" />
                                <text x={leftPad - 8} y={y + 3} fill="var(--text-secondary)" fontSize="10" textAnchor="end" fontWeight="600">{formatAxisTickValue(t, unit)}</text>
                            </g>
                        );
                    })}

                    {type === 'line' ? (
                        <>
                            <polyline points={areaPoints} fill={`url(#grad-${chartId})`} />
                            <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            {nums.map((v, i) => (
                                <circle key={i} cx={xAt(i)} cy={yAt(v)} r="3.5" fill="var(--surface-sunken)" stroke={color} strokeWidth="2.5" />
                            ))}
                        </>
                    ) : (
                        nums.map((v, i) => {
                            const bh = Math.max(2, (plotH * (v - yMin)) / (yMax - yMin));
                            const bx = xAt(i) - barWidth / 2 + (plotW / nums.length / 2);
                            const by = yAt(v);
                            return (
                                <rect
                                    key={i}
                                    x={bx}
                                    y={by}
                                    width={barWidth}
                                    height={bh}
                                    fill={color}
                                    rx="4"
                                    opacity="0.85"
                                />
                            );
                        })
                    )}

                    {/* X Axis Labels */}
                    {nums.map((_, i) => {
                        const labelText = xLabels[i] || `P${i + 1}`;
                        const isLong = labelText.length > 8;
                        const x = type === 'line' ? xAt(i) : xAt(i) + (plotW / nums.length / 2);
                        const y = topPad + plotH + 18;
                        return (
                            <text 
                                key={`x-${i}`} 
                                x={x} 
                                y={y} 
                                fill="var(--text-secondary)" 
                                fontSize="9" 
                                fontWeight="700" 
                                textAnchor={isLong ? "end" : "middle"}
                                transform={isLong ? `rotate(-25, ${x}, ${y})` : ""}
                            >
                                {labelText}
                            </text>
                        );
                    })}
                </svg>
            </div>
        </article>
    );
};

export default MetricChart;
