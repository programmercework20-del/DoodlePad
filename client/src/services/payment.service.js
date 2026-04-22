import api from './api';

export const paymentService = {
    getAllPayments: async () => {
        const response = await api.get('/payments');
        return response.data;
    },

    simulatePayment: async (payload) => {
        const response = await api.post('/payments/mock', payload);
        return response.data;
    },
};
