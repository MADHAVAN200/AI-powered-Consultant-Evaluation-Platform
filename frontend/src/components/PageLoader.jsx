import React from 'react';

const PageLoader = ({ message = 'Loading...', subMessage = 'Please wait while we fetch your data.' }) => {
  return (
    <div className="page-loader-wrap" role="status" aria-live="polite">
      <div className="page-loader-card">
        <div className="page-loader-gif" aria-hidden="true">
          <span className="page-loader-orbit page-loader-orbit--a" />
          <span className="page-loader-orbit page-loader-orbit--b" />
          <span className="page-loader-core" />
        </div>
        <div className="page-loader-title">{message}</div>
        <div className="page-loader-sub">{subMessage}</div>
      </div>
    </div>
  );
};

export default PageLoader;
