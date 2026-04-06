import React from 'react';

const DataDetailSidebar = ({ data, onClose }) => {
  if (!data || !data.raw_data) return null;

  const rows = data.raw_data;
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <>
      <div className="sidebar-overlay" onClick={onClose}></div>
      <div className="decision-sidebar" style={{ width: '800px', maxWidth: '90vw' }}>
        <div className="sidebar-header">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>[DATA_SNAPSHOT] {data.scenario_name?.toUpperCase()}</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Full tabular view of ingested enterprise history.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
        </div>

        <div className="sidebar-body" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
             <div className="panel" style={{ flex: 1, padding: '16px' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: '800', opacity: 0.5 }}>AVG REVENUE</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '900' }}>₹{(data.revenue / 10000000).toFixed(2)} Cr</div>
             </div>
             <div className="panel" style={{ flex: 1, padding: '16px' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: '800', opacity: 0.5 }}>TOTAL ROWS</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '900' }}>{rows.length}</div>
             </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border-default)', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1, borderBottom: '2px solid var(--border-default)' }}>
                <tr>
                  {columns.map(col => (
                    <th key={col} style={{ padding: '12px 16px', fontWeight: '800', opacity: 0.7, textTransform: 'uppercase', fontSize: '0.65rem', borderBottom: '1px solid var(--border-default)' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-default)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    {columns.map(col => (
                      <td key={col} style={{ padding: '12px 16px', borderRight: '1px solid var(--border-default)', opacity: 0.9 }}>
                        {typeof row[col] === 'number' ? row[col].toLocaleString() : row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: 'var(--accent-primary-alpha)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)' }}>
             <p style={{ fontSize: '0.75rem', margin: 0, fontWeight: '600' }}>
               💡 Pro Tip: Use the [DECISIONS & INSIGHTS] module to see how the AI has interpreted this specific dataset across Conservative, Balanced, and Aggressive perspectives.
             </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default DataDetailSidebar;
