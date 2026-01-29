import api from './api';

export const postService = {
    getAllPosts: async (params) => {
        const response = await api.get('/posts', { params });
        return response.data;
    },

    getPostById: async (id) => {
        const response = await api.get(`/posts/${id}`);
        return response.data;
    },

    hidePost: async (id) => {
        const response = await api.post(`/posts/${id}/hide`);
        return response.data;
    },

    deletePost: async (id) => {
        const response = await api.delete(`/posts/${id}`);
        return response.data;
    },

    markSensitive: async (id) => {
        const response = await api.post(`/posts/${id}/mark-sensitive`);
        return response.data;
    },

    toggleComments: async (id, disabled) => {
        const response = await api.patch(`/posts/${id}/comments`, { disabled });
        return response.data;
    },
};
