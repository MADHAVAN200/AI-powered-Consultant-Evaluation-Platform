// frontend/src/hooks/useCaseStudyUpload.js
// Custom hook: upload a PDF, get back structured sections for the sidebar.

import { useState } from 'react';

/**
 * useCaseStudyUpload()
 *
 * Returns:
 *   upload(file)  — call with a File object from <input type="file">
 *   loading       — boolean
 *   error         — string | null
 *   caseData      — { title, sections } | null
 */
export function useCaseStudyUpload() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [caseData, setCaseData] = useState(null);

    async function upload(file) {
        if (!file) return;
        setLoading(true);
        setError(null);
        setCaseData(null);

        const formData = new FormData();
        formData.append('pdf', file);

        try {
            const res = await fetch('/api/upload/case-study', {
                method: 'POST',
                body: formData,
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.error || 'Upload failed.');
            }

            setCaseData(json.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return { upload, loading, error, caseData };
}
