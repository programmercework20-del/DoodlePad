// import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
// import { commentService } from '@/services/comment.service';

// export const fetchComments = createAsyncThunk(
//     'comments/fetchAll',
//     async (params, { rejectWithValue }) => {
//         try {
//             const response = await commentService.getAllComments(params);
//             return response.data;
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || 'Failed to fetch comments');
//         }
//     }
// );

// export const hideComment = createAsyncThunk(
//     'comments/hide',
//     async (id, { rejectWithValue }) => {
//         try {
//             await commentService.hideComment(id);
//             return id;
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || 'Failed to hide comment');
//         }
//     }
// );

// export const deleteComment = createAsyncThunk(
//     'comments/delete',
//     async (id, { rejectWithValue }) => {
//         try {
//             await commentService.deleteComment(id);
//             return id;
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || 'Failed to delete comment');
//         }
//     }
// );

// const initialState = {
//     comments: [],
//     pagination: {
//         page: 1,
//         limit: 10,
//         total: 0,
//         pages: 0
//     },
//     loading: false,
//     error: null,
// };

// const commentSlice = createSlice({
//     name: 'comments',
//     initialState,
//     reducers: {
//         clearCommentError: (state) => {
//             state.error = null;
//         }
//     },
//     extraReducers: (builder) => {
//         builder
//             .addCase(fetchComments.pending, (state) => {
//                 state.loading = true;
//                 state.error = null;
//             })
//             .addCase(fetchComments.fulfilled, (state, action) => {
//                 state.loading = false;
//                 state.comments = action.payload.comments;
//                 state.pagination = action.payload.pagination;
//             })
//             .addCase(fetchComments.rejected, (state, action) => {
//                 state.loading = false;
//                 state.error = action.payload;
//             })
//             .addCase(hideComment.fulfilled, (state, action) => {
//                 const index = state.comments.findIndex(c => c.id === action.payload);
//                 if (index !== -1) {
//                     state.comments[index].status = 'hidden';
//                 }
//             })
//             .addCase(deleteComment.fulfilled, (state, action) => {
//                 state.comments = state.comments.filter(c => c.id !== action.payload);
//             });
//     },
// });


// // Selectors
// export const selectCommentsState = (state) => state.comments;
// export const selectComments = createSelector(
//     [selectCommentsState],
//     (commentState) => ({
//         comments: commentState.comments,
//         pagination: commentState.pagination,
//         loading: commentState.loading,
//         error: commentState.error,
//     })
// );

// export const { clearCommentError } = commentSlice.actions;
// export default commentSlice.reducer;



import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { commentService } from '@/services/comment.service';

export const fetchComments = createAsyncThunk(
    'comments/fetchAll',
    async (params, { rejectWithValue }) => {
        try {
            const res = await commentService.getAllComments(params);
            return res.data;
        } catch (err) {
            return rejectWithValue(err.response?.data?.message);
        }
    }
);

export const hideComment = createAsyncThunk(
    'comments/hide',
    async (id, { rejectWithValue }) => {
        try {
            await commentService.hideComment(id);
            return id;
        } catch (err) {
            return rejectWithValue({ id, error: err.response?.data?.message });
        }
    }
);

export const deleteComment = createAsyncThunk(
    'comments/delete',
    async (id, { rejectWithValue }) => {
        try {
            await commentService.deleteComment(id);
            return id;
        } catch (err) {
            return rejectWithValue({ id, error: err.response?.data?.message });
        }
    }
);

const initialState = {
    comments: [],
    deletedBackup: {}, // 🔥 rollback support
    pagination: {},
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
            // fetch
            .addCase(fetchComments.pending, (state) => {
                state.loading = true;
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

            // 🔥 HIDE (optimistic)
            .addCase(hideComment.pending, (state, action) => {
                const id = action.meta.arg;
                const comment = state.comments.find(c => c.id === id);

                if (comment) {
                    comment.status = 'hidden'; // instant UI
                }
            })

            .addCase(hideComment.rejected, (state, action) => {
                const { id } = action.payload || {};
                const comment = state.comments.find(c => c.id === id);

                if (comment) {
                    comment.status = 'active'; // rollback
                }
            })

            // 🔥 DELETE (optimistic)
            .addCase(deleteComment.pending, (state, action) => {
                const id = action.meta.arg;

                const comment = state.comments.find(c => c.id === id);
                if (comment) {
                    state.deletedBackup[id] = comment; // backup
                    state.comments = state.comments.filter(c => c.id !== id);
                }
            })

            .addCase(deleteComment.rejected, (state, action) => {
                const { id } = action.payload || {};
                if (state.deletedBackup[id]) {
                    state.comments.push(state.deletedBackup[id]); // rollback
                    delete state.deletedBackup[id];
                }
            })

            .addCase(deleteComment.fulfilled, (state, action) => {
                delete state.deletedBackup[action.payload]; // cleanup
            });
    },
});

export const selectComments = (state) => state.comments;
export const { clearCommentError } = commentSlice.actions;
export default commentSlice.reducer;