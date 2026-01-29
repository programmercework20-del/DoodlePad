import { useState, useEffect } from 'react';

export const useFetch = (fetchFn, dependencies = []) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const refetch = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetchFn();
            if (response.success) {
                setData(response.data);
            }
        } catch (err) {
            setError(err);
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetch();
    }, dependencies);

    return { data, loading, error, refetch };
};
