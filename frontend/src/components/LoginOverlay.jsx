import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import loginHero from '../assets/login-hero.png';

const LoginOverlay = ({ theme, toggleTheme }) => {
    const { loginUser } = useData();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        // Simulate a slight delay for "premium" feel
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const result = loginUser(username, password);
        if (result.success) {
            if (result.role === 'admin') {
                navigate('/admin/dashboard');
            } else if (result.role === 'candidate') {
                navigate('/candidate/dashboard');
            }
        } else {
            setError('Invalid credentials. Please verify and try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page-wrapper">
            <div className="login-split-container">
                {/* Visual Side */}
                <div className="login-visual-side">
                    <img src={loginHero} alt="Consultant Workspace" className="login-hero-img" />
                    <div className="login-visual-overlay">
                        <div className="login-branding">
                            <div className="brand-badge">SECURE ACCESS</div>
                            <h1 className="brand-title">AI Consultant</h1>
                            <p className="brand-tagline">Advanced Enterprise Analytics & Strategic Evaluation Portal</p>
                        </div>
                        <div className="login-visual-footer">
                            <div className="system-status">
                                <span className="status-dot-pulse"></span>
                                SYSTEM OPERATIONAL
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Side */}
                <div className="login-form-side">
                    <div className="login-form-header">
                        <button className="theme-toggle-minimal" onClick={toggleTheme}>
                            {theme === 'light' ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                            )}
                        </button>
                    </div>

                    <div className="login-form-container">
                        <div className="form-head">
                            <h2>Welcome back</h2>
                            <p>Please enter your credentials to access the portal</p>
                        </div>

                        <form onSubmit={handleSubmit} className="premium-form">
                            {error && <div className="login-error-msg">{error}</div>}
                            
                            <div className="premium-input-group">
                                <label>Username</label>
                                <input 
                                    type="text" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    required
                                    autoComplete="username"
                                />
                            </div>

                            <div className="premium-input-group">
                                <label>Password</label>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                />
                            </div>

                            <button type="submit" className="premium-login-btn" disabled={isLoading}>
                                {isLoading ? (
                                    <span className="btn-loader"></span>
                                ) : (
                                    "SIGN IN TO PORTAL"
                                )}
                            </button>
                        </form>
                    </div>
                    
                    <div className="login-form-footer">
                        &copy; 2026 AI Powered Consultant for Enterprises. All rights reserved.
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .login-page-wrapper {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: var(--bg-default);
                    z-index: 10000;
                    overflow: hidden;
                    font-family: 'Poppins', sans-serif;
                }

                .login-split-container {
                    display: flex;
                    width: 100%;
                    height: 100%;
                }

                .login-visual-side {
                    flex: 1.2;
                    position: relative;
                    overflow: hidden;
                    background: #000;
                    display: flex;
                }

                @media (max-width: 1024px) {
                    .login-visual-side {
                        display: none;
                    }
                }

                .login-hero-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    opacity: 0.7;
                    filter: saturate(1.2) contrast(1.1);
                    transition: transform 10s ease;
                }

                .login-visual-side:hover .login-hero-img {
                    transform: scale(1.05);
                }

                .login-visual-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to right, rgba(11, 14, 20, 0.9) 0%, rgba(11, 14, 20, 0.4) 50%, rgba(11, 14, 20, 0.2) 100%);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: flex-start;
                    padding: 60px;
                }

                .login-branding {
                    max-width: 520px;
                }

                .brand-badge {
                    display: inline-block;
                    padding: 6px 12px;
                    background: rgba(45, 136, 255, 0.15);
                    border: 1px solid rgba(45, 136, 255, 0.3);
                    color: #2d88ff;
                    font-size: 0.65rem;
                    font-weight: 800;
                    border-radius: 6px;
                    letter-spacing: 0.1em;
                    margin-bottom: 24px;
                }

                .brand-title {
                    font-size: 3.5rem;
                    font-weight: 800;
                    color: #fff;
                    line-height: 1.1;
                    margin-bottom: 16px;
                    letter-spacing: -0.03em;
                }

                .brand-tagline {
                    font-size: 1.1rem;
                    color: rgba(255, 255, 255, 0.7);
                    max-width: 400px;
                    line-height: 1.6;
                }

                .login-visual-footer {
                    position: absolute;
                    left: 60px;
                    right: 60px;
                    bottom: 44px;
                }

                .system-status {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.5);
                    letter-spacing: 0.05em;
                }

                .status-dot-pulse {
                    width: 8px;
                    height: 8px;
                    background: #22c55e;
                    border-radius: 50%;
                    position: relative;
                }

                .status-dot-pulse::after {
                    content: '';
                    position: absolute;
                    inset: -4px;
                    border-radius: 50%;
                    border: 2px solid #22c55e;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(2.5); opacity: 0; }
                }

                .login-form-side {
                    flex: 1;
                    background: var(--bg-subtle);
                    display: flex;
                    flex-direction: column;
                    padding: 40px;
                    position: relative;
                }

                .login-form-header {
                    display: flex;
                    justify-content: flex-end;
                }

                .theme-toggle-minimal {
                    background: none;
                    border: 1px solid var(--border-default);
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: var(--text-secondary);
                    transition: all 0.2s;
                }

                .theme-toggle-minimal:hover {
                    background: var(--bg-default);
                    color: var(--accent-primary);
                    border-color: var(--accent-primary);
                }

                .login-form-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    max-width: 400px;
                    margin: 0 auto;
                    width: 100%;
                }

                .form-head h2 {
                    font-size: 2rem;
                    font-weight: 800;
                    margin-bottom: 8px;
                    color: var(--text-primary);
                }

                .form-head p {
                    color: var(--text-secondary);
                    font-size: 0.95rem;
                    margin-bottom: 40px;
                }

                .premium-form {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .premium-input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .premium-input-group label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .premium-input-group input {
                    background: var(--bg-default);
                    border: 1px solid var(--border-default);
                    padding: 14px 16px;
                    border-radius: 12px;
                    color: var(--text-primary);
                    font-size: 1rem;
                    transition: all 0.2s;
                }

                .premium-input-group input:focus {
                    outline: none;
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 4px rgba(45, 136, 255, 0.1);
                }

                .premium-login-btn {
                    background: var(--accent-primary);
                    color: white;
                    border: none;
                    padding: 16px;
                    border-radius: 12px;
                    font-weight: 800;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-top: 10px;
                    letter-spacing: 0.02em;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 52px;
                }

                .premium-login-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(45, 136, 255, 0.3);
                }

                .premium-login-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .btn-loader {
                    width: 20px;
                    height: 20px;
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .login-error-msg {
                    background: rgba(248, 81, 73, 0.1);
                    color: #f85149;
                    padding: 12px 16px;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    border: 1px solid rgba(248, 81, 73, 0.2);
                }

                .login-form-footer {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    text-align: center;
                    opacity: 0.6;
                }
            `}} />
        </div>
    );
};

export default LoginOverlay;
