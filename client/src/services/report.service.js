import api from './api';

export const reportService = {
    // Get all reports with filters
    getAllReports: async (params = {}) => {
        const response = await api.get('/reports', { params });
        return response.data;
    },

    // Get report by ID
    getReportById: async (id) => {
        const response = await api.get(`/reports/${id}`);
        return response.data;
    },

    // Update report status
    updateStatus: async (id, status) => {
        const response = await api.patch(`/reports/${id}/status`, { status });
        return response.data;
    },

    // Update report priority
    updatePriority: async (id, priority) => {
        const response = await api.patch(`/reports/${id}/priority`, { priority });
        return response.data;
    }
};
