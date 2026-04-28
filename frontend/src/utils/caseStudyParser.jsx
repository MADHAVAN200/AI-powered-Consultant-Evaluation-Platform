/**
 * Shared utility functions for parsing case study content.
 */

export const renderFormattedMessage = (content) => {
    const lines = String(content || '').split('\n');
    const elements = [];
    let currentGroup = [];
    let groupType = null; // 'bullets' | 'numbered' | 'text'
    let globalCounter = 0; 

    const flushGroup = () => {
        if (currentGroup.length === 0) return;
        if (groupType === 'bullets') {
            elements.push(
                <ul key={elements.length} className="msg-list bullet-list">
                    {currentGroup.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
            );
        } else if (groupType === 'numbered') {
            elements.push(
                <ol key={elements.length} className="msg-list numbered-list" start={globalCounter - currentGroup.length + 1}>
                    {currentGroup.map((l, i) => <li key={i}>{l}</li>)}
                </ol>
            );
        } else {
            currentGroup.forEach((l, i) => {
                elements.push(<p key={`${elements.length}-${i}`} className="msg-para">{l}</p>);
            });
        }
        currentGroup = [];
        groupType = null;
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) { flushGroup(); return; }

        if (/^\d+[).:]\s/.test(line)) {
            if (groupType !== 'numbered') { flushGroup(); groupType = 'numbered'; }
            globalCounter++;
            currentGroup.push(line.replace(/^\d+[).:] ?/, '').trim());
        } else if (/^[-•→—]\s/.test(line)) {
            if (groupType !== 'bullets') { flushGroup(); groupType = 'bullets'; }
            currentGroup.push(line.replace(/^[-•→—]\s/, '').trim());
        } else if (line.endsWith(':') && line.length < 40 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
            flushGroup();
            elements.push(<p key={elements.length} className="msg-section-label">{line}</p>);
        } else {
            if (groupType !== 'text') { flushGroup(); groupType = 'text'; }
            currentGroup.push(line);
        }
    });
    flushGroup();
    return elements.length > 0 ? elements : content;
};

export const parseSectionCards = (content = '') => {
    const lines = String(content || '').replace(/\r\n/g, '\n').split('\n').map((line) => line.trim());
    const blocks = [];
    const summaryLines = [];
    let currentBlock = null;

    const flushBlock = () => {
        if (!currentBlock) return;
        if (currentBlock.heading && currentBlock.items.length > 0) {
            blocks.push(currentBlock);
        }
        currentBlock = null;
    };

    for (const line of lines) {
        if (!line) {
            flushBlock();
            continue;
        }

        const isSubHeading = line.endsWith(':') && line.length <= 90 && !/^\d+[).]\s+/.test(line);
        const bulletMatch = line.match(/^(?:[-*•]|\d+[).])\s+(.+)$/);

        if (isSubHeading) {
            flushBlock();
            currentBlock = {
                heading: line.replace(/:\s*$/, '').trim(),
                items: []
            };
            continue;
        }

        const cleaned = bulletMatch ? bulletMatch[1].trim() : line;
        if (currentBlock) {
            currentBlock.items.push(cleaned);
        } else {
            summaryLines.push(cleaned);
        }
    }

    flushBlock();

    return {
        summary: summaryLines.join(' ').trim(),
        blocks
    };
};

export const extractInlineSeries = (text = '') => {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const groups = [];
    let currentGroup = null;
    let pendingLabel = '';

    for (const line of lines) {
        const stripped = line.replace(/^[•\-\*●]\s*/, '').trim();
        const kvMatch = stripped.match(/^([^:]{1,60}):\s*([-+]?\d[\d,.]*(?:\.\d+)?)\s*([A-Za-z%/]*)(?:\s.*)?$/);
        
        if (kvMatch) {
            const pointLabel = kvMatch[1].trim();
            let value = parseFloat(kvMatch[2].replace(/,/g, ''));
            const unitSuffix = (kvMatch[3] || '').toLowerCase();
            
            if (Number.isFinite(value)) {
                if (unitSuffix === 'cr') value *= 100;
                else if (unitSuffix === 'm') value *= 10;
                else if (unitSuffix === 'k') value /= 100;
                
                if (!currentGroup) {
                    currentGroup = { groupLabel: pendingLabel || 'Series', points: [], unit: unitSuffix || 'count' };
                    groups.push(currentGroup);
                }
                currentGroup.points.push({ label: pointLabel, value, rawValue: parseFloat(kvMatch[2].replace(/,/g, '')), unit: unitSuffix });
                continue;
            }
        }

        if (currentGroup) {
            if (currentGroup.points.length < 2) groups.pop();
            currentGroup = null;
        }
        
        if (stripped.length > 0 && stripped.length < 60 && !stripped.includes('.') && stripped.endsWith(':')) {
            pendingLabel = stripped.slice(0, -1).trim();
        } else if (stripped.length > 0 && stripped.length < 60 && !stripped.includes('•')) {
            pendingLabel = stripped;
        }
    }

    if (currentGroup && currentGroup.points.length < 2) groups.pop();
    return groups.filter((g) => g.points.length >= 2);
};
