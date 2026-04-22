import api from './api';

export const revenueService = {
    getOverview: async () => {
        const response = await api.get('/revenue/overview');
        return response.data;
    },

    getAdRevenue: async (id) => {
        const response = await api.get(`/revenue/ad/${id}`);
        return response.data;
    },
};
