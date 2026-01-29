import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { liveService } from '@/services/live.service';

export const fetchLiveSessions = createAsyncThunk(
    'live/fetchAll',
    async (params, { rejectWithValue }) => {
        try {
            const response = await liveService.getAllLiveSessions(params);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch live sessions');
        }
    }
);

export const endLiveSession = createAsyncThunk(
    'live/end',
    async ({ id, reason }, { rejectWithValue }) => {
        try {
            await liveService.endLiveSession(id, reason);
            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to end session');
        }
    }
);

export const blockHost = createAsyncThunk(
    'live/blockHost',
    async (id, { rejectWithValue }) => {
        try {
            await liveService.blockHost(id);
            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to block host');
        }
    }
);

const initialState = {
    liveSessions: [],
    pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0
    },
    loading: false,
    error: null,
};

const liveSlice = createSlice({
    name: 'live',
    initialState,
    reducers: {
        clearLiveError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchLiveSessions.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchLiveSessions.fulfilled, (state, action) => {
                state.loading = false;
                state.liveSessions = action.payload.liveSessions;
                state.pagination = action.payload.pagination;
            })
            .addCase(fetchLiveSessions.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(endLiveSession.fulfilled, (state, action) => {
                const index = state.liveSessions.findIndex(s => s.id === action.payload);
                if (index !== -1) {
                    state.liveSessions[index].status = 'terminated';
                }
            })
            // blockHost also ends session usually, so we can update status too or just refetch
            .addCase(blockHost.fulfilled, (state, action) => {
                const index = state.liveSessions.findIndex(s => s.id === action.payload);
                if (index !== -1) {
                    state.liveSessions[index].status = 'terminated';
                }
            });
    },
});

export const { clearLiveError } = liveSlice.actions;
export default liveSlice.reducer;
