import api from './api';

export const authService = {
    login: async (email, password) => {
        return api.post('/admin/login', { email, password });
    },

    verify: async () => {
        return api.get('/admin/verify');
    },

    logout: async () => {
        try {
            const response = await api.post('/admin/logout');
            return response.data;
        } finally {
            // Always clear localStorage even if API call fails
            localStorage.removeItem('token');
            localStorage.removeItem('admin');
        }
    },
};
