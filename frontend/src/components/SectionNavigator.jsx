// frontend/src/components/SectionNavigator.jsx
// Renders the sidebar from dynamically parsed PDF sections — zero hardcoding.

import { useState } from 'react';

// Badge colours per section type (matches AdminEvaluation design system)
const TYPE_STYLES = {
    DATA:     { label: 'DATA',     bg: '#e8f4fd', color: '#2563eb' },
    CONTEXT:  { label: 'CONTEXT',  bg: '#f0fdf4', color: '#16a34a' },
    PROBLEM:  { label: 'PROBLEM',  bg: '#fef2f2', color: '#dc2626' },
    INTERNAL: { label: 'INTERNAL', bg: '#fefce8', color: '#ca8a04' },
};

/**
 * SectionNavigator
 *
 * Props:
 *   sections  — array from parsePDF API response ({ id, title, type, content[] })
 *   onSelect  — (section) => void, called when user clicks a section
 */
export function SectionNavigator({ sections = [], onSelect }) {
    const [activeId, setActiveId] = useState(null);

    function handleClick(section) {
        setActiveId(section.id);
        onSelect?.(section);
    }

    if (!sections.length) {
        return (
            <div style={{ padding: '16px', color: '#6b7280', fontSize: '13px' }}>
                No sections detected. Upload a PDF to get started.
            </div>
        );
    }

    return (
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px' }}>
            {sections.map((section) => {
                const style = TYPE_STYLES[section.type] ?? TYPE_STYLES.CONTEXT;
                const isActive = activeId === section.id;

                return (
                    <button
                        key={section.id}
                        onClick={() => handleClick(section)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            background: isActive ? '#eff6ff' : 'transparent',
                            fontWeight: isActive ? 600 : 400,
                            fontSize: '13px',
                            color: isActive ? '#1d4ed8' : '#374151',
                            transition: 'background 0.15s',
                        }}
                    >
                        {/* Strip the leading number prefix for cleaner display */}
                        <span style={{ flex: 1 }}>
                            {section.title.replace(/^\d+\.\s*/, '')}
                        </span>
                        <span
                            style={{
                                marginLeft: '8px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 600,
                                background: style.bg,
                                color: style.color,
                                letterSpacing: '0.05em',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {style.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}

/**
 * SectionContent
 *
 * Renders the content of the currently selected section.
 * Handles both plain strings and { subheading } objects from PyMuPDF parser.
 */
export function SectionContent({ section }) {
    if (!section) {
        return (
            <div style={{ padding: '24px', color: '#9ca3af', fontSize: '14px' }}>
                Select a section from the sidebar to view its content.
            </div>
        );
    }

    const content = Array.isArray(section.content) ? section.content : [];

    return (
        <div style={{ padding: '24px', maxWidth: '720px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#111827' }}>
                {section.title}
            </h2>

            {content.map((item, idx) => {
                if (typeof item === 'string') {
                    return (
                        <p key={idx} style={{ fontSize: '14px', color: '#374151', margin: '4px 0' }}>
                            {item}
                        </p>
                    );
                }

                if (item && item.subheading) {
                    return (
                        <p
                            key={idx}
                            style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#1f2937',
                                marginTop: '14px',
                                marginBottom: '4px',
                            }}
                        >
                            {item.subheading}
                        </p>
                    );
                }

                return null;
            })}
        </div>
    );
}
