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
            setError('Invalid credentials');
        }
    };

    return (
        <div className="login-overlay">
            <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
                <button 
                    className="theme-toggle" 
                    onClick={toggleTheme} 
                    style={{ fontSize: '0.7rem', fontWeight: '800', padding: '6px 12px' }}
                >
                    {theme === 'light' ? 'DARK' : 'LIGHT'}
                </button>
            </div>

            <div className="login-card glassmorphism">
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <h1 style={{ fontSize: '1.2rem', fontWeight: '900', letterSpacing: '0.06em', color: 'var(--text-primary)', margin: 0 }}>AI CONSULTANT</h1>
                    <p style={{ margin: '6px 0 0', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>LOGIN</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {error && <div style={{ color: '#ff4444', fontSize: '0.7rem', fontWeight: '700', textAlign: 'center' }}>{error}</div>}
                    
                    <div className="form-group">
                        <label style={{ fontSize: '0.66rem', fontWeight: '800', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>User name</label>
                        <input 
                            type="text" 
                            name="username"
                            autoComplete="username"
                            className="login-input" 
                            placeholder="User name"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            style={{ width: '100%', padding: '13px 14px', borderRadius: '10px', border: '1px solid var(--border-default)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                        />
                    </div>

                    <div className="form-group">
                        <label style={{ fontSize: '0.66rem', fontWeight: '800', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>Password</label>
                        <input 
                            type="password" 
                            name="password"
                            autoComplete="current-password"
                            className="login-input" 
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{ width: '100%', padding: '13px 14px', borderRadius: '10px', border: '1px solid var(--border-default)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="login-btn"
                        style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'var(--accent-primary)', color: 'white', fontWeight: '800', fontSize: '0.78rem', cursor: 'pointer', transition: 'transform 0.2s', marginTop: '2px', letterSpacing: '0.03em' }}
                    >
                        LOGIN
                    </button>
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
                    width: 360px;
                    padding: 34px 30px;
                    border: 1px solid var(--border-default);
                    border-radius: 16px;
                    background: var(--bg-card);
                    box-shadow: 0 12px 44px rgba(0,0,0,0.25);
                }
                .login-btn:hover {
                    box-shadow: 0 0 14px var(--accent-primary-alpha);
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
