import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

const LoginOverlay = ({ theme, toggleTheme }) => {
    const { loginUser } = useData();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const result = loginUser(username, password);
        if (result.success) {
            setError('');
            // Navigate to respective dashboard based on role
            if (result.role === 'admin') {
                navigate('/admin/dashboard');
            } else if (result.role === 'candidate') {
                navigate('/candidate/dashboard');
            }
        } else {
            setError('ACCESS DENIED: INVALID CREDENTIALS');
        }
    };

    return (
        <div className="login-overlay">
            {/* Theme Toggle Button (Same as TopBar) */}
            <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
                <button 
                    className="theme-toggle" 
                    onClick={toggleTheme} 
                    style={{ fontSize: '0.7rem', fontWeight: '800', padding: '6px 12px' }}
                >
                    {theme === 'light' ? 'DARK MODE' : 'LIGHT MODE'}
                </button>
            </div>

            <div className="login-card glassmorphism">
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--accent-primary)', marginBottom: '8px', letterSpacing: '0.2em' }}>[ENTERPRISE_AUTHENTICATION]</div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '900', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>AI STRATEGIC ADVISOR</h1>
                    <p style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '8px', color: 'var(--text-secondary)' }}>Login with your secure credentials to sync historical intelligence snapshots.</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {error && <div style={{ color: '#ff4444', fontSize: '0.65rem', fontWeight: '800', textAlign: 'center', padding: '8px', background: 'rgba(255,68,68,0.1)', borderRadius: '4px' }}>{error}</div>}
                    
                    <div className="form-group">
                        <label style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.7, marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>USER IDENTIFIER</label>
                        <input 
                            type="text" 
                            className="login-input" 
                            placeholder="admin / user"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                        />
                    </div>

                    <div className="form-group">
                        <label style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.7, marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>SECURITY TOKEN (PASSWORD)</label>
                        <input 
                            type="password" 
                            className="login-input" 
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="login-btn"
                        style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: 'var(--accent-primary)', color: 'white', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer', transition: 'transform 0.2s', marginTop: '8px' }}
                    >
                        SYNC INTELLIGENCE SESSION
                    </button>
                    <div style={{ fontSize: '0.6rem', textAlign: 'center', opacity: 0.6, marginTop: '12px', color: 'var(--text-secondary)' }}>
                        BY PROCEEDING, YOU AGREE TO LOCAL DATA PERSISTENCE & CLOUD LOGGING.
                    </div>
                </form>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .login-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: var(--bg-default);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    transition: background 0.3s ease;
                }
                .login-card {
                    width: 400px;
                    padding: 48px;
                    border: 1px solid var(--border-default);
                    border-radius: 20px;
                    background: var(--bg-card);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                }
                .login-btn:hover {
                    box-shadow: 0 0 20px var(--accent-primary-alpha);
                    transform: translateY(-2px);
                }
                .login-input {
                    transition: all 0.2s ease;
                }
                .login-input:focus {
                    outline: none;
                    border-color: var(--accent-primary);
                    background: rgba(255,255,255,0.05);
                }
            `}} />
        </div>
    );
};

export default LoginOverlay;
