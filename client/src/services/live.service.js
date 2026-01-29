import api from './api';

export const liveService = {
    // Get all live sessions with filters
    getAllLiveSessions: async (params = {}) => {
        const response = await api.get('/live', { params });
        return response.data;
    },

    // End a live session
    endLiveSession: async (id, reason) => {
        const response = await api.post(`/live/${id}/end`, { reason });
        return response.data;
    },

    // Block host (prevent future live sessions)
    blockHost: async (id) => {
        const response = await api.post(`/live/${id}/block-host`);
        return response.data;
    }
};
