import api from './api';

export const analyticsService = {
    getDashboardStats: async () => {
        const response = await api.get('/analytics/dashboard');
        return response.data;
    },

    getActivityTrends: async (days = 7) => {
        const response = await api.get('/analytics/trends', { params: { days } });
        return response.data;
    },
};
