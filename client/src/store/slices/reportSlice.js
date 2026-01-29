import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { reportService } from '@/services/report.service';

export const fetchReports = createAsyncThunk(
    'reports/fetchAll',
    async (params, { rejectWithValue }) => {
        try {
            const response = await reportService.getAllReports(params);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch reports');
        }
    }
);

export const updateReportStatus = createAsyncThunk(
    'reports/updateStatus',
    async ({ id, status }, { rejectWithValue }) => {
        try {
            const response = await reportService.updateStatus(id, status);
            return { id, status, ...response.data };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to update report status');
        }
    }
);

const initialState = {
    reports: [],
    pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0
    },
    loading: false,
    error: null,
};

const reportSlice = createSlice({
    name: 'reports',
    initialState,
    reducers: {
        clearReportError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Reports
            .addCase(fetchReports.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchReports.fulfilled, (state, action) => {
                state.loading = false;
                state.reports = action.payload.reports;
                state.pagination = action.payload.pagination;
            })
            .addCase(fetchReports.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Update Status
            .addCase(updateReportStatus.fulfilled, (state, action) => {
                const index = state.reports.findIndex(r => r.id === action.payload.id);
                if (index !== -1) {
                    state.reports[index].status = action.payload.status;
                }
            });
    },
});

export const { clearReportError } = reportSlice.actions;
export default reportSlice.reducer;
