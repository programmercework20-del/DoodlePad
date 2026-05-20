import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import reportReducer from './slices/reportSlice';
import commentReducer from './slices/commentSlice';
import liveReducer from './slices/liveSlice';
import messageReducer from './slices/messageSlice';
import analyticsReducer from './slices/analyticsSlice';
import adReducer from './slices/adSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        users: userReducer,
        reports: reportReducer,
        comments: commentReducer,
        live: liveReducer,
        messages: messageReducer,
        analytics: analyticsReducer,
        ads: adReducer,
    },
});

export default store;
