import { useState, useEffect, useCallback, useRef } from 'react';

export const useFetch = (fetchFn, dependencies = []) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const abortControllerRef = useRef(null);
    const isMounted = useRef(true);

    const refetch = useCallback(async () => {
        // Cancel any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new abort controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            setLoading(true);
            setError(null);

            const response = await fetchFn();

            if (isMounted.current && !controller.signal.aborted) {
                if (response.success) {
                    setData(response.data);
                }
            }
        } catch (err) {
            if (isMounted.current && !controller.signal.aborted) {
                setError(err);
                console.error('Fetch error:', err);
            }
        } finally {
            if (isMounted.current && !controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, [fetchFn]); // Dependencies are handled by the caller via the 'dependencies' array below

    useEffect(() => {
        isMounted.current = true;
        refetch();

        return () => {
            isMounted.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, dependencies); // Re-run when dependencies change

    return { data, loading, error, refetch };
};
