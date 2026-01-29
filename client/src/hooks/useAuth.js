import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { verifyAuth } from '@/store/slices/authSlice';

export const useAuth = () => {
    const dispatch = useDispatch();
    const { admin, isAuthenticated, loading, error } = useSelector((state) => state.auth);

    // Only verify ONCE when hook is first mounted
    useEffect(() => {
        if (!isAuthenticated && !loading) {
            dispatch(verifyAuth());
        }
    }, []); // Empty dependency - runs only once

    return {
        admin,
        loading,
        error,
        isAuthenticated,
    };
};
