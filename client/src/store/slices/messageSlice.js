import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { messageService } from '@/services/message.service';

export const fetchMessages = createAsyncThunk(
    'messages/fetchAll',
    async (params, { rejectWithValue }) => {
        try {
            const response = await messageService.getReportedMessages(params);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch messages');
        }
    }
);

export const flagMessage = createAsyncThunk(
    'messages/flag',
    async (id, { rejectWithValue }) => {
        try {
            await messageService.flagMessage(id);
            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to flag message');
        }
    }
);

export const deleteMessage = createAsyncThunk(
    'messages/delete',
    async (id, { rejectWithValue }) => {
        try {
            await messageService.deleteMessage(id);
            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to delete message');
        }
    }
);

const initialState = {
    messages: [],
    deletedBackup: {}, // 🔥 Added for rollback
    pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0
    },
    loading: false,
    error: null,
};

const messageSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        clearMessageError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchMessages.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchMessages.fulfilled, (state, action) => {
                state.loading = false;
                state.messages = action.payload.messages;
                state.pagination = action.payload.pagination;
            })
            .addCase(fetchMessages.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // 🔥 Optimistic Delete
            .addCase(deleteMessage.pending, (state, action) => {
                const id = action.meta.arg;
                const message = state.messages.find(m => m.id === id);
                if (message) {
                    state.deletedBackup[id] = message;
                    state.messages = state.messages.filter(m => m.id !== id);
                }
            })
            .addCase(deleteMessage.rejected, (state, action) => {
                const id = action.meta.arg;
                if (state.deletedBackup[id]) {
                    state.messages.push(state.deletedBackup[id]);
                    delete state.deletedBackup[id];
                }
            });
    },
});


// Selectors
export const selectMessagesState = (state) => state.messages;
export const selectMessages = createSelector(
    [selectMessagesState],
    (messageState) => ({
        messages: messageState.messages,
        pagination: messageState.pagination,
        loading: messageState.loading,
        error: messageState.error,
    })
);

export const { clearMessageError } = messageSlice.actions;
export default messageSlice.reducer;
