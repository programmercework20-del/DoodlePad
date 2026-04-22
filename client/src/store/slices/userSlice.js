// import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
// import { userService } from '@/services/user.service';

// // Thunks
// export const fetchUsers = createAsyncThunk(
//     'users/fetchAll',
//     async (params, { rejectWithValue }) => {
//         try {
//             const response = await userService.getAllUsers(params);
//             return response.data;
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || 'Failed to fetch users');
//         }
//     }
// );

// export const fetchUserById = createAsyncThunk(
//     'users/fetchById',
//     async (id, { rejectWithValue }) => {
//         try {
//             const response = await userService.getUserById(id);
//             return response.data;
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || 'Failed to fetch user details');
//         }
//     }
// );

// export const warnUser = createAsyncThunk(
//     'users/warn',
//     async ({ id, reason }, { rejectWithValue }) => {
//         try {
//             const response = await userService.warnUser(id, reason);
//             return { id, ...response.data };
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || 'Failed to warn user');
//         }
//     }
// );

// export const blockUser = createAsyncThunk(
//     'users/block',
//     async ({ id, reason }, { rejectWithValue }) => {
//         try {
//             const response = await userService.blockUser(id, reason);
//             return { id, ...response.data };
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || 'Failed to block user');
//         }
//     }
// );

// export const unblockUser = createAsyncThunk(
//     'users/unblock',
//     async (id, { rejectWithValue }) => {
//         try {
//             const response = await userService.unblockUser(id);
//             return { id, ...response.data };
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || 'Failed to unblock user');
//         }
//     }
// );

// export const banUser = createAsyncThunk(
//     'users/ban',
//     async ({ id, reason }, { rejectWithValue }) => {
//         try {
//             const response = await userService.banUser(id, reason);
//             return { id, ...response.data };
//         } catch (error) {
//             return rejectWithValue(error.response?.data?.message || 'Failed to ban user');
//         }
//     }
// );

// const initialState = {
//     users: [],
//     currentUser: null,
//     stats: null,
//     pagination: {
//         page: 1,
//         limit: 10,
//         total: 0,
//         pages: 0
//     },
//     loading: false,
//     error: null,
// };

// const userSlice = createSlice({
//     name: 'users',
//     initialState,
//     reducers: {
//         clearUserError: (state) => {
//             state.error = null;
//         },
//         clearCurrentUser: (state) => {
//             state.currentUser = null;
//         }
//     },
//     extraReducers: (builder) => {
//         builder
//             // Fetch Users
//             .addCase(fetchUsers.pending, (state) => {
//                 state.loading = true;
//                 state.error = null;
//             })
//             .addCase(fetchUsers.fulfilled, (state, action) => {
//                 state.loading = false;
//                 state.users = action.payload.users;
//                 state.pagination = action.payload.pagination;
//             })
//             .addCase(fetchUsers.rejected, (state, action) => {
//                 state.loading = false;
//                 state.error = action.payload;
//             })
//             // Fetch User By ID
//             .addCase(fetchUserById.pending, (state) => {
//                 state.loading = true;
//                 state.error = null;
//             })

//             // .addCase(fetchUserById.fulfilled, (state, action) => {
//             //     state.loading = false;
//             //     state.currentUser = action.payload.user;
//             //     state.stats = action.payload.stats;
//             // })

//                 .addCase(fetchUserById.fulfilled, (state, action) => {
//     state.loading = false;
//     state.currentUser = action.payload.data?.user || action.payload.user;
//     state.stats = action.payload.data?.stats || action.payload.stats;
// })

//             .addCase(fetchUserById.rejected, (state, action) => {
//                 state.loading = false;
//                 state.error = action.payload;
//             })
//             // Actions (Warn, Block, Ban, Unblock)
//             // Just assume success updates local state or trigger refetch in component
//             // We can optimistic update here if backend returns full updated object
//             .addCase(warnUser.fulfilled, (state, action) => {
//                 if (state.currentUser && state.currentUser.id === action.payload.id) {
//                     state.currentUser.status = 'warned';
//                     state.currentUser.warningCount += 1;
//                 }
//             })
//             .addCase(blockUser.fulfilled, (state, action) => {
//                 if (state.currentUser && state.currentUser.id === action.payload.id) {
//                     state.currentUser.status = 'blocked';
//                 }
//             })
//             .addCase(unblockUser.fulfilled, (state, action) => {
//                 if (state.currentUser && state.currentUser.id === action.payload.id) {
//                     state.currentUser.status = 'active';
//                 }
//             })
//             .addCase(banUser.fulfilled, (state, action) => {
//                 if (state.currentUser && state.currentUser.id === action.payload.id) {
//                     state.currentUser.status = 'banned';
//                 }
//             });
//     },
// });

// export const { clearUserError, clearCurrentUser } = userSlice.actions;
// export default userSlice.reducer;


import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { userService } from '@/services/user.service';

export const fetchUsers = createAsyncThunk(
    'users/fetchAll',
    async (params, { rejectWithValue }) => {
        try {
            const response = await userService.getAllUsers(params);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch users');
        }
    }
);

export const fetchUserById = createAsyncThunk(
    'users/fetchById',
    async (id, { rejectWithValue }) => {
        try {
            const response = await userService.getUserById(id);
            // 🔥 FIX: userService already response.data return karta hai
            // toh response = { success, data: { user, stats } }
            return response;
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch user details');
        }
    }
);

export const warnUser = createAsyncThunk(
    'users/warn',
    async ({ id, reason }, { rejectWithValue }) => {
        try {
            const response = await userService.warnUser(id, reason);
            return { id, ...response.data };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to warn user');
        }
    }
);

export const blockUser = createAsyncThunk(
    'users/block',
    async ({ id, reason }, { rejectWithValue }) => {
        try {
            const response = await userService.blockUser(id, reason);
            return { id, ...response.data };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to block user');
        }
    }
);

export const unblockUser = createAsyncThunk(
    'users/unblock',
    async (id, { rejectWithValue }) => {
        try {
            const response = await userService.unblockUser(id);
            return { id, ...response.data };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to unblock user');
        }
    }
);

export const banUser = createAsyncThunk(
    'users/ban',
    async ({ id, reason }, { rejectWithValue }) => {
        try {
            const response = await userService.banUser(id, reason);
            return { id, ...response.data };
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || 'Failed to ban user');
        }
    }
);

const initialState = {
    users: [],
    currentUser: null,
    stats: null,
    pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0
    },
    loading: false,
    error: null,
};

const userSlice = createSlice({
    name: 'users',
    initialState,
    reducers: {
        clearUserError: (state) => {
            state.error = null;
        },
        clearCurrentUser: (state) => {
            state.currentUser = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchUsers.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchUsers.fulfilled, (state, action) => {
                state.loading = false;
                state.users = action.payload.users;
                state.pagination = action.payload.pagination;
            })
            .addCase(fetchUsers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchUserById.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchUserById.fulfilled, (state, action) => {
    state.loading = false;
    state.currentUser = action.payload?.profile?.user || null;
    state.stats = action.payload?.profile?.stats || null;
})
            .addCase(fetchUserById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(warnUser.fulfilled, (state, action) => {
                if (state.currentUser && state.currentUser.id === action.payload.id) {
                    state.currentUser.status = 'warned';
                    state.currentUser.warningCount += 1;
                }
            })
            .addCase(blockUser.fulfilled, (state, action) => {
                if (state.currentUser && state.currentUser.id === action.payload.id) {
                    state.currentUser.status = 'blocked';
                }
            })
            .addCase(unblockUser.fulfilled, (state, action) => {
                if (state.currentUser && state.currentUser.id === action.payload.id) {
                    state.currentUser.status = 'active';
                }
            })
            .addCase(banUser.fulfilled, (state, action) => {
                if (state.currentUser && state.currentUser.id === action.payload.id) {
                    state.currentUser.status = 'banned';
                }
            });
    },
});

export const { clearUserError, clearCurrentUser } = userSlice.actions;
export default userSlice.reducer;