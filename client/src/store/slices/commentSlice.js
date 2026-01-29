import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { commentService } from '@/services/comment.service';

export const fetchComments = createAsyncThunk(
    'comments/fetchAll',
    async (params, { rejectWithValue }) => {
        try {
            const response = await commentService.getAllComments(params);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch comments');
        }
    }
);

export const hideComment = createAsyncThunk(
    'comments/hide',
    async (id, { rejectWithValue }) => {
        try {
            await commentService.hideComment(id);
            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to hide comment');
        }
    }
);

export const deleteComment = createAsyncThunk(
    'comments/delete',
    async (id, { rejectWithValue }) => {
        try {
            await commentService.deleteComment(id);
            return id;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to delete comment');
        }
    }
);

const initialState = {
    comments: [],
    pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0
    },
    loading: false,
    error: null,
};

const commentSlice = createSlice({
    name: 'comments',
    initialState,
    reducers: {
        clearCommentError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchComments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchComments.fulfilled, (state, action) => {
                state.loading = false;
                state.comments = action.payload.comments;
                state.pagination = action.payload.pagination;
            })
            .addCase(fetchComments.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(hideComment.fulfilled, (state, action) => {
                const index = state.comments.findIndex(c => c.id === action.payload);
                if (index !== -1) {
                    state.comments[index].status = 'hidden';
                }
            })
            .addCase(deleteComment.fulfilled, (state, action) => {
                state.comments = state.comments.filter(c => c.id !== action.payload);
            });
    },
});

export const { clearCommentError } = commentSlice.actions;
export default commentSlice.reducer;
