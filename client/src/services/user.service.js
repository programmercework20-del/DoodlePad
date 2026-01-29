import api from './api';

export const userService = {
    getAllUsers: async (params) => {
        const response = await api.get('/users', { params });
        return response.data;
    },

    getUserById: async (id) => {
        const response = await api.get(`/users/${id}`);
        return response.data;
    },

    warnUser: async (id, reason) => {
        const response = await api.post(`/users/${id}/warn`, { reason });
        return response.data;
    },

    blockUser: async (id, reason, duration) => {
        const response = await api.post(`/users/${id}/block`, { reason, duration });
        return response.data;
    },

    banUser: async (id, reason) => {
        const response = await api.post(`/users/${id}/ban`, { reason });
        return response.data;
    },

    unblockUser: async (id) => {
        const response = await api.post(`/users/${id}/unblock`);
        return response.data;
    },

    restrictFeatures: async (id, restrictions) => {
        const response = await api.patch(`/users/${id}/restrict`, restrictions);
        return response.data;
    },
};
