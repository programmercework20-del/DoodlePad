import api from './api';

export const commentService = {
    getAllComments: async (params = {}) => {
        const response = await api.get('/comments', { params });
        return response.data;
    },

    deleteComment: async (id) => {
        const response = await api.delete(`/comments/${id}`);
        return response.data;
    },

    hideComment: async (id) => {
        const response = await api.post(`/comments/${id}/hide`);
        return response.data;
    }
};
