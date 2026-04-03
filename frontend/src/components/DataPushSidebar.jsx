import React, { useState } from 'react';

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
      { id: 'warehouse', label: 'Warehouse Name', placeholder: 'COMPUTE_WH' },
      { id: 'user', label: 'Username', placeholder: 'admin_service' }
    ]
  },
  aws: { 
    name: 'AWS S3 Storage', code: 'CLD', 
    fields: [
      { id: 'bucket', label: 'Bucket Name', placeholder: 'enterprise-data-lake' },
      { id: 'region', label: 'AWS Region', placeholder: 'us-west-2' },
      { id: 'accessKey', label: 'Access Key ID', placeholder: 'AKIA....' }
    ]
  },
  ga4: { 
    name: 'Google Analytics 4', code: 'WEB', 
    fields: [
      { id: 'propertyId', label: 'GA4 Property ID', placeholder: '123456789', help: 'Found in GA4 Admin > Property Settings.' },
      { id: 'email', label: 'Service Account Email', placeholder: 'analyst@project.iam.gserviceaccount.com' }
    ]
  },
  zendesk: { 
    name: 'Zendesk Support', code: 'SUP', 
    fields: [
      { id: 'subdomain', label: 'Subdomain', placeholder: 'mycompany', help: 'The prefix of your .zendesk.com URL.' },
      { id: 'email', label: 'Admin Email', placeholder: 'admin@company.com' },
      { id: 'token', label: 'API Token', placeholder: '••••••••••••••••', type: 'password' }
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
  const [step, setStep] = useState('SELECT'); // SELECT, CONFIGURE, SYNCING
  const [selectedTool, setSelectedTool] = useState(null);
  const [progress, setProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState(SYNC_MESSAGES[0]);
  const [file, setFile] = useState(null);

  const startConfig = (toolId) => {
    setSelectedTool(toolId);
    setStep('CONFIGURE');
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
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    }, 60);
  };

  const handleManualUpload = () => {
    if (!file) return;
    setStep('SYNCING');
    setSyncStatus("Parsing document schema...");
    let p = 0;
    const interval = setInterval(() => {
      p += 5;
      setProgress(p);
      if (p >= 50) setSyncStatus("Vectorizing enterprise data...");
      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => onClose(), 800);
      }
    }, 100);
  };

  return (
    <>
      <div className="sidebar-overlay" onClick={onClose}></div>
      <div className="decision-sidebar">
        <div className="sidebar-header" style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Sync Knowledge Hub</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {step === 'SELECT' ? 'Choose your data source' : 
               step === 'CONFIGURE' ? `Configure ${TOOL_CONFIGS[selectedTool]?.name}` : 
               'Synchronizing in progress...'}
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
                    <div 
                      key={id} 
                      className="source-card" 
                      onClick={() => startConfig(id)}
                      style={{ padding: '16px', textAlign: 'center', cursor: 'pointer' }}
                    >
                      <div style={{ fontSize: '0.7rem', fontWeight: '900', marginBottom: '12px', color: 'var(--accent-primary)', letterSpacing: '0.05em' }}>
                        [{config.code}]
                      </div>
                      <div style={{ fontSize: '0.8rem', fontWeight: '800' }}>{config.name}</div>
                    </div>
                  ))}
                </div>
              </section>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }}></div>
                <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--text-secondary)' }}>OR MANUAL UPLOAD</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }}></div>
              </div>

              <section className="panel" style={{ padding: '24px', borderStyle: 'dashed', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '900', marginBottom: '12px', color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>[LOCAL_UPLOAD]</div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700' }}>{file ? file.name : "Select Local File"}</h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Excel, CSV or JSON supported</p>
                <input type="file" id="file-upload" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
                <label htmlFor="file-upload" style={{ padding: '8px 16px', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}>
                   {file ? "Change File" : "Choose File"}
                </label>
                {file && (
                  <button 
                    onClick={handleManualUpload}
                    style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent-primary)', color: 'white', fontWeight: '800', cursor: 'pointer' }}
                  >
                    Ingest Snapshot ➔
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
                 <button 
                   onClick={() => setStep('SELECT')}
                   style={{ padding: '14px', borderRadius: '10px', border: '1px solid var(--border-default)', background: 'var(--bg-card)', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}
                 >
                   Back
                 </button>
                 <button 
                   onClick={executeSync}
                   style={{ flex: 1, padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: 'var(--accent-primary)', color: 'white', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer' }}
                 >
                   Establish Connection ➔
                 </button>
              </div>
            </>
          )}

          {step === 'SYNCING' && (
            <div style={{ marginTop: 'auto', padding: '24px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '12px', fontWeight: '800' }}>
                <span>{syncStatus}</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#52c41a', transition: 'width 0.1s linear' }}></div>
              </div>
              <p style={{ marginTop: '12px', fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.5' }}>
                System is mapping {selectedTool ? TOOL_CONFIGS[selectedTool].name : 'local data'} entities into the master intelligence graph...
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default DataPushSidebar;
