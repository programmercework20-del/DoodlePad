import api from './api';

export const adService = {
    getAllAds: async (params) => {
        const response = await api.get('/ads', { params });
        return response.data;
    },

    getAdById: async (id) => {
        const response = await api.get(`/ads/${id}`);
        return response.data;
    },

    createAd: async (payload) => {
        const response = await api.post('/ads', payload);
        return response.data;
    },

    updateAd: async (id, payload) => {
        const response = await api.put(`/ads/${id}`, payload);
        return response.data;
    },

    deleteAd: async (id) => {
        const response = await api.delete(`/ads/${id}`);
        return response.data;
    },

    toggleAdStatus: async (id) => {
        const response = await api.patch(`/ads/${id}/toggle`);
        return response.data;
    },

    trackView: async (id) => {
        const response = await api.post(`/ads/${id}/view`);
        return response.data;
    },

    trackClick: async (id) => {
        const response = await api.post(`/ads/${id}/click`);
        return response.data;
    },
};
