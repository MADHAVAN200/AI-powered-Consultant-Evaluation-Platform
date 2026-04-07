import React, { useState } from 'react';
import Papa from 'papaparse';
import { useData } from '../context/DataContext';

const TOOL_CONFIGS = {
  sap: { 
    name: 'SAP S/4HANA', code: 'ERP', 
    fields: [
      { id: 'url', label: 'Service OData URL', placeholder: 'https://my-instance.s4hana.ondemand.com', help: 'The base OData service URL for your SAP instance.' },
      { id: 'client', label: 'Client ID', placeholder: '001', help: 'Standard 3-digit SAP Client Identifier.' },
      { id: 'apikey', label: 'API Key / Secret', placeholder: '••••••••••••••••', type: 'password' }
    ]
  },
  salesforce: { 
    name: 'Salesforce CRM', code: 'CRM', 
    fields: [
      { id: 'instance', label: 'Instance URL', placeholder: 'https://mycompany.my.salesforce.com', help: 'Your unique Salesforce domain URL.' },
      { id: 'clientId', label: 'Consumer Key', placeholder: '3MVG9sk2....' },
      { id: 'clientSecret', label: 'Consumer Secret', placeholder: '••••••••••••••••', type: 'password' }
    ]
  },
  snowflake: { 
    name: 'Snowflake', code: 'DW', 
    fields: [
      { id: 'account', label: 'Account Identifier', placeholder: 'xy12345.us-east-1', help: 'Your Snowflake account locator or organization.account name.' },
      { id: 'warehouse', warehouse: 'Warehouse Name', placeholder: 'COMPUTE_WH' },
      { id: 'user', label: 'Username', placeholder: 'admin_service' }
    ]
  }
};

const SYNC_MESSAGES = [
  "Initializing OAuth2 handshake...",
  "Validating Client Credentials...",
  "Establishing Secure WebSocket tunnel...",
  "Requesting Schema Metadata...",
  "Mapping JSON entites to Knowledge Graph...",
  "Finalizing Data Ingestion..."
];

const DataPushSidebar = ({ onClose }) => {
  const { updateMetrics, setIsBatching, runEnrichedAnalysis } = useData();
  const [step, setStep] = useState('SELECT'); // SELECT, CONFIGURE, SYNCING
  const [selectedTool, setSelectedTool] = useState(null);
  const [progress, setProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState(SYNC_MESSAGES[0]);
  const [files, setFiles] = useState([]); // Multiple files instead of single

  const startConfig = (toolId) => {
    setSelectedTool(toolId);
    setStep('CONFIGURE');
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const executeSync = () => {
    setStep('SYNCING');
    let p = 0;
    const interval = setInterval(() => {
      p += 2;
      setProgress(p);
      
      const msgIndex = Math.floor((p / 100) * SYNC_MESSAGES.length);
      if (SYNC_MESSAGES[msgIndex]) setSyncStatus(SYNC_MESSAGES[msgIndex]);

      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => onClose(), 1500);
      }
    }, 60);
  };

  const handleManualUpload = async () => {
    if (files.length === 0) return;
    setStep('SYNCING');
    setIsBatching(true); // SILENCE AI during batch

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setSyncStatus(`Processing ${i + 1} of ${files.length}: ${file.name}`);
        setProgress(0);

        await new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                complete: (results) => {
                    const validRows = results.data.filter(r => r && Object.keys(r).length > 2);
                    const patterns = /date|time|period|month|year|week/i;
                    const headers = results.meta?.fields || [];
                    const dateCol = headers.find(h => patterns.test(h));

                    const sorted = dateCol 
                      ? [...validRows].sort((a, b) => new Date(b[dateCol]) - new Date(a[dateCol]))
                      : validRows;

                    const parsedData = sorted.length > 0 ? sorted[0] : null;

                    if (parsedData) {
                        let p = 0;
                        const interval = setInterval(() => {
                            p += 20;
                            setProgress(p * ((i + 1) / files.length)); 
                            if (p >= 100) {
                                clearInterval(interval);
                                updateMetrics(parsedData, sorted);
                                resolve();
                            }
                        }, 20);
                    } else {
                        resolve();
                    }
                }
            });
        });
    }

    setSyncStatus("Ingestion Complete. Generating Final Strategic Insights...");
    setProgress(100);
    
    // FINAL CONSOLIDATED TRIGGER
    await runEnrichedAnalysis(true); 
    setIsBatching(false);

    setTimeout(() => onClose(), 1000);
  };

  return (
    <>
      <div className="sidebar-overlay" onClick={onClose}></div>
      <div className="decision-sidebar">
        <div className="sidebar-header" style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Sync Knowledge Hub</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {step === 'SELECT' ? 'Connect multiple enterprise sources' : 
               step === 'CONFIGURE' ? `Configure ${TOOL_CONFIGS[selectedTool]?.name}` : 
               'Batch Synchronizing...'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
        </div>

        <div className="sidebar-body" style={{ gap: '24px', paddingTop: '20px' }}>
          
          <div className="wizard-steps">
            <div className={`step-indicator active`}></div>
            <div className={`step-indicator ${step !== 'SELECT' ? 'active' : ''}`}></div>
            <div className={`step-indicator ${step === 'SYNCING' ? 'active' : ''}`}></div>
          </div>

          {step === 'SELECT' && (
            <>
              <section>
                <h3 className="form-label" style={{ marginBottom: '16px' }}>Enterprise Connectors</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {Object.entries(TOOL_CONFIGS).map(([id, config]) => (
                    <div key={id} className="source-card" onClick={() => startConfig(id)} style={{ padding: '16px', textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: '900', marginBottom: '12px', color: 'var(--accent-primary)', letterSpacing: '0.05em' }}>[{config.code}]</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: '800' }}>{config.name}</div>
                    </div>
                  ))}
                </div>
              </section>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }}></div>
                <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-secondary)' }}>BATCH MANUAL UPLOAD</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }}></div>
              </div>

              <section className="panel" style={{ padding: '24px', borderStyle: 'dashed', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '900', marginBottom: '12px', color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>[LOCAL_BATCH_PUSH]</div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700' }}>{files.length > 0 ? `${files.length} Files Selected` : "Select Local Snapshots"}</h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>CSV, JSON or Excel (Multi-select enabled)</p>
                
                <input 
                  type="file" 
                  id="file-upload" 
                  multiple 
                  style={{ display: 'none' }} 
                  onChange={handleFileChange} 
                />
                <label htmlFor="file-upload" style={{ padding: '8px 16px', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}>
                   {files.length > 0 ? "Add More Files" : "Choose Files"}
                </label>

                {files.length > 0 && (
                  <div style={{ marginTop: '20px', textAlign: 'left', maxHeight: '160px', overflowY: 'auto', borderTop: '1px solid var(--border-default)', paddingTop: '12px' }}>
                    {files.map((f, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.6rem', padding: '2px 4px', background: 'var(--bg-subtle)', borderRadius: '3px' }}>{f.name.split('.').pop().toUpperCase()}</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        </div>
                        <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {files.length > 0 && (
                  <button onClick={handleManualUpload} style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent-primary)', color: 'white', fontWeight: '800', cursor: 'pointer' }}>
                    Ingest {files.length} Snapshots ➔
                  </button>
                )}
              </section>
            </>
          )}

          {step === 'CONFIGURE' && (
            <>
              <section>
                {TOOL_CONFIGS[selectedTool].fields.map(field => (
                  <div key={field.id} className="form-group">
                    <label className="form-label">{field.label}</label>
                    <input className="form-input" type={field.type || 'text'} placeholder={field.placeholder} />
                    {field.help && <div className="form-help">{field.help}</div>}
                  </div>
                ))}
              </section>

              <div style={{ marginTop: 'auto', display: 'flex', gap: '12px' }}>
                 <button onClick={() => setStep('SELECT')} style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border-default)', background: 'var(--bg-card)', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}>Back</button>
                 <button onClick={executeSync} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--accent-primary)', color: 'white', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer' }}>Establish Connection ➔</button>
              </div>
            </>
          )}

          {step === 'SYNCING' && (
            <div style={{ marginTop: 'auto', padding: '24px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '12px', fontWeight: '800' }}>
                <span style={{ fontSize: '0.7rem' }}>{syncStatus}</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#52c41a', transition: 'width 0.2s linear' }}></div>
              </div>
              <p style={{ marginTop: '12px', fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.5' }}>
                AI Model is isolating {selectedTool ? TOOL_CONFIGS[selectedTool].name : 'batch enterprise'} data points to perform high-density trend detection...
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default DataPushSidebar;
