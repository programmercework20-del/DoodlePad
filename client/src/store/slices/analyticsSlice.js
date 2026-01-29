import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { analyticsService } from '@/services/analytics.service';

export const fetchDashboardStats = createAsyncThunk(
    'analytics/fetchStats',
    async (_, { rejectWithValue }) => {
        try {
            const response = await analyticsService.getDashboardStats();
            return response.data; // Assuming response structure is { success: true, data: { ... } } or similar
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch stats');
        }
    }
);

const initialState = {
    stats: null,
    loading: false,
    error: null,
};

const analyticsSlice = createSlice({
    name: 'analytics',
    initialState,
    reducers: {
        clearAnalyticsError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDashboardStats.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchDashboardStats.fulfilled, (state, action) => {
                state.loading = false;
                state.stats = action.payload; // Be careful with payload structure here
            })
            .addCase(fetchDashboardStats.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export const { clearAnalyticsError } = analyticsSlice.actions;
export default analyticsSlice.reducer;
