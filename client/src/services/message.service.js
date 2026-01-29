import api from './api';

export const messageService = {
    // Get reported messages (privacy focused)
    getReportedMessages: async (params = {}) => {
        const response = await api.get('/messages/reported', { params });
        return response.data;
    },

    // Flag a message (mark as reviewed/flagged)
    flagMessage: async (id) => {
        const response = await api.post(`/messages/${id}/flag`);
        return response.data;
    },

    // Delete a message (mark as deleted)
    deleteMessage: async (id) => {
        const response = await api.delete(`/messages/${id}`);
        return response.data;
    }
};
