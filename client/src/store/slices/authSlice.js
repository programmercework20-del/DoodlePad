import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { authService } from '@/services/auth.service';

// Async thunks
export const loginAdmin = createAsyncThunk(
    'auth/login',
    async ({ email, password }, { rejectWithValue }) => {
        try {
            const response = await authService.login(email, password);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Login failed');
        }
    }
);

export const verifyAuth = createAsyncThunk(
    'auth/verify',
    async (_, { rejectWithValue }) => {
        try {
            const response = await authService.verify();
            return response.data;
        } catch (error) {
            // Pass status code to handle logout logic
            return rejectWithValue({
                message: error.response?.data?.message || 'Verification failed',
                status: error.response?.status
            });
        }
    }
);

export const logoutAdmin = createAsyncThunk(
    'auth/logout',
    async (_, { rejectWithValue }) => {
        try {
            await authService.logout();
            return null;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Logout failed');
        }
    }
);

// Initial state - Load from LocalStorage
const token = localStorage.getItem('token');
const adminData = JSON.parse(localStorage.getItem('admin') || 'null');

const initialState = {
    admin: adminData,
    token: token,
    isAuthenticated: !!token, // If token exists, assume authenticated initially
    loading: false,
    error: null,
};

// Slice
const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        resetAuth: (state) => {
            state.admin = null;
            state.token = null;
            state.isAuthenticated = false;
            state.loading = false;
            state.error = null;
            localStorage.removeItem('token');
            localStorage.removeItem('admin');
        },
    },
    extraReducers: (builder) => {
        builder
            // Login
            .addCase(loginAdmin.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loginAdmin.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.admin = action.payload.data;
                state.token = action.payload.token;
                state.error = null;

                // Save to localStorage
                if (action.payload.token) {
                    localStorage.setItem('token', action.payload.token);
                    localStorage.setItem('admin', JSON.stringify(action.payload.data));
                }
            })
            .addCase(loginAdmin.rejected, (state, action) => {
                state.loading = false;
                state.isAuthenticated = false;
                state.admin = null;
                state.token = null;
                state.error = action.payload;
            })
            // Verify
            .addCase(verifyAuth.pending, (state) => {
                // state.loading = true; // Avoid flickering on refresh
            })
            .addCase(verifyAuth.fulfilled, (state, action) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.admin = action.payload.data;
                localStorage.setItem('admin', JSON.stringify(action.payload.data));
                // Verify assumes token is valid, so we don't need to update it unless it changed
            })
            .addCase(verifyAuth.rejected, (state, action) => {
                state.loading = false;

                // Only logout if explicit auth error (401/403)
                // If it's a network error or server error (500), keep the session for retry
                if (action.payload?.status === 401 || action.payload?.status === 403) {
                    state.isAuthenticated = false;
                    state.admin = null;
                    state.token = null;
                    localStorage.removeItem('token');
                    localStorage.removeItem('admin');
                } else {
                    // Start in error state but don't wipe data
                    // This prevents logout on refresh if server is down
                    console.warn("Verify Auth Failed (Server Issue?), keeping session.", action.payload);
                    state.error = action.payload?.message || "Session verification failed";
                }
            })
            // Logout
            .addCase(logoutAdmin.fulfilled, (state) => {
                state.admin = null;
                state.token = null;
                state.isAuthenticated = false;
                state.loading = false;
                state.error = null;
                localStorage.removeItem('token');
                localStorage.removeItem('admin');
            });
    },
});

// Selectors
const selectAuthBase = (state) => state.auth;

export const selectAuth = createSelector(
    [selectAuthBase],
    (auth) => ({
        admin: auth.admin,
        isAuthenticated: auth.isAuthenticated,
        loading: auth.loading,
        error: auth.error,
    })
);

export const { clearError, resetAuth } = authSlice.actions;
export default authSlice.reducer;

