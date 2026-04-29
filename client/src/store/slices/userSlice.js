import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { userService } from '@/services/user.service';

const mergeUserRecord = (existingUser, incomingUser) => {
    if (!incomingUser) return existingUser;
    if (!existingUser) return incomingUser;

    return {
        ...existingUser,
        ...incomingUser,
    };
};

const updateUserInState = (state, userId, updatedUser) => {
    if (!userId || !updatedUser) return;

    if (state.currentUser && state.currentUser.id === userId) {
        state.currentUser = mergeUserRecord(state.currentUser, updatedUser);
    }

    const index = state.users.findIndex((user) => user.id === userId);
    if (index !== -1) {
        state.users[index] = mergeUserRecord(state.users[index], updatedUser);
    }
};

const updateUserStatusOptimistically = (state, userId, status) => {
    if (!userId) return;

    if (state.currentUser && state.currentUser.id === userId) {
        state.currentUser.status = status;
        if (status === 'warned') {
            state.currentUser.warningCount = (state.currentUser.warningCount || 0) + 1;
        }
    }

    const index = state.users.findIndex((user) => user.id === userId);
    if (index !== -1) {
        state.users[index].status = status;
        if (status === 'warned') {
            state.users[index].warningCount = (state.users[index].warningCount || 0) + 1;
        }
    }
};

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
            return response.data;
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
            return { id, user: response.user };
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
            return { id, user: response.user };
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
            return { id, user: response.user };
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
            return { id, user: response.user };
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
        pages: 0,
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
        },
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
                state.currentUser = action.payload.user;
                state.stats = action.payload.stats;
                updateUserInState(state, action.payload.user?.id, action.payload.user);
            })
            .addCase(fetchUserById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(warnUser.pending, (state, action) => {
                state.error = null;
                updateUserStatusOptimistically(state, action.meta.arg.id, 'warned');
            })
            .addCase(warnUser.fulfilled, (state, action) => {
                updateUserInState(state, action.payload.id, action.payload.user);
            })
            .addCase(warnUser.rejected, (state, action) => {
                state.error = action.payload;
            })
            .addCase(blockUser.pending, (state, action) => {
                state.error = null;
                updateUserStatusOptimistically(state, action.meta.arg.id, 'blocked');
            })
            .addCase(blockUser.fulfilled, (state, action) => {
                updateUserInState(state, action.payload.id, action.payload.user);
            })
            .addCase(blockUser.rejected, (state, action) => {
                state.error = action.payload;
            })
            .addCase(unblockUser.pending, (state, action) => {
                state.error = null;
                updateUserStatusOptimistically(state, action.meta.arg, 'active');
            })
            .addCase(unblockUser.fulfilled, (state, action) => {
                updateUserInState(state, action.payload.id, action.payload.user);
            })
            .addCase(unblockUser.rejected, (state, action) => {
                state.error = action.payload;
            })
            .addCase(banUser.pending, (state, action) => {
                state.error = null;
                updateUserStatusOptimistically(state, action.meta.arg.id, 'banned');
            })
            .addCase(banUser.fulfilled, (state, action) => {
                updateUserInState(state, action.payload.id, action.payload.user);
            })
            .addCase(banUser.rejected, (state, action) => {
                state.error = action.payload;
            });
    },
});

const selectUsersBase = (state) => state.users;

export const selectUsersState = createSelector(
    [selectUsersBase],
    (usersState) => ({
        users: usersState.users,
        pagination: usersState.pagination,
        loading: usersState.loading,
        error: usersState.error,
    })
);

export const selectCurrentUserState = createSelector(
    [selectUsersBase],
    (usersState) => ({
        currentUser: usersState.currentUser,
        stats: usersState.stats,
        loading: usersState.loading,
        error: usersState.error,
    })
);

export const { clearUserError, clearCurrentUser } = userSlice.actions;
export default userSlice.reducer;
