// import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
// import { analyticsService } from '@/services/analytics.service';

// export const fetchDashboardStats = createAsyncThunk(
//     'analytics/fetchStats',
//     async (_, { rejectWithValue }) => {
//         try {
//             const response = await analyticsService.getDashboardStats();
//             return response.data; // Assuming response structure is { success: true, data: { ... } } or similar
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || 'Failed to fetch stats');
//         }
//     }
// );

// const initialState = {
//     stats: null,
//     loading: false,
//     error: null,
// };

// const analyticsSlice = createSlice({
//     name: 'analytics',
//     initialState,
//     reducers: {
//         clearAnalyticsError: (state) => {
//             state.error = null;
//         }
//     },
//     extraReducers: (builder) => {
//         builder
//             .addCase(fetchDashboardStats.pending, (state) => {
//                 state.loading = true;
//                 state.error = null;
//             })
//             .addCase(fetchDashboardStats.fulfilled, (state, action) => {
//                 state.loading = false;
//                 state.stats = action.payload; // Be careful with payload structure here
//             })
//             .addCase(fetchDashboardStats.rejected, (state, action) => {
//                 state.loading = false;
//                 state.error = action.payload;
//             });
//     },
// });

// // Selectors
// const selectAnalyticsBase = (state) => state.analytics;

// export const selectAnalyticsState = createSelector(
//     [selectAnalyticsBase],
//     (analytics) => ({
//         stats: analytics.stats,
//         loading: analytics.loading,
//         error: analytics.error,
//     })
// );

// export const { clearAnalyticsError } = analyticsSlice.actions;
// export default analyticsSlice.reducer;




import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { analyticsService } from '@/services/analytics.service';

// ⏱️ Cache duration (5 min)
const CACHE_DURATION = 5 * 60 * 1000;

export const fetchDashboardStats = createAsyncThunk(
    'analytics/fetchStats',
    async (_, { getState, rejectWithValue }) => {
        try {
            const state = getState().analytics;
            const now = Date.now();

            // 🔥 Cache check
            if (state.lastFetched && now - state.lastFetched < CACHE_DURATION) {
                // return existing data (skip API)
                return state.stats;
            }

            const response = await analyticsService.getDashboardStats();

            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message || 'Failed to fetch stats'
            );
        }
    }
);

// 🔥 Initial State
const initialState = {
    stats: null,
    loading: false,
    error: null,
    lastFetched: null, // ✅ added
};

const analyticsSlice = createSlice({
    name: 'analytics',
    initialState,
    reducers: {
        clearAnalyticsError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDashboardStats.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchDashboardStats.fulfilled, (state, action) => {
                state.loading = false;
                state.stats = action.payload;
                state.lastFetched = Date.now(); // ✅ update timestamp
            })
            .addCase(fetchDashboardStats.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

// 🔥 Selectors
const selectAnalyticsBase = (state) => state.analytics;

export const selectAnalyticsState = createSelector(
    [selectAnalyticsBase],
    (analytics) => ({
        stats: analytics.stats,
        loading: analytics.loading,
        error: analytics.error,
    })
);

export const { clearAnalyticsError } = analyticsSlice.actions;
export default analyticsSlice.reducer;