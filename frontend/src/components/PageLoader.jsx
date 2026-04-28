import React from 'react';

const PageLoader = ({ message = 'Loading System...', subMessage = 'Initializing core modules and security layers.' }) => {
  return (
    <div className="elite-loader-container" role="status" aria-live="polite">
      <div className="elite-loader-visual">
        <div className="loader-ring"></div>
        <div className="loader-ring"></div>
        <div className="loader-ring"></div>
        <div className="loader-pulse"></div>
      </div>
      <div className="elite-loader-content">
        <div className="elite-loader-title">{message}</div>
        <div className="elite-loader-sub">{subMessage}</div>
      </div>
      <div className="elite-loader-footer">
        <div className="loader-progress-bar">
          <div className="loader-progress-fill"></div>
        </div>
        <span className="loader-secure-tag">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          SECURE CONNECTION
        </span>
      </div>
    </div>
  );
};

export default PageLoader;
