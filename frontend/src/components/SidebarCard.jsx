import React from 'react';

const SidebarCard = ({ label, variant = 'default', children }) => (
    <div className={`sidebar-card sidebar-card--${variant}`}>
        <div className="sidebar-card__header">
            <h3 className="sidebar-card__title">{label}</h3>
        </div>
        <div className="sidebar-card__body">{children}</div>
    </div>
);

export default SidebarCard;
