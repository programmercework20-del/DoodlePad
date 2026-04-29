// import axios from 'axios';

// const api = axios.create({
//     baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
//     withCredentials: true, // Needed for cookies if we still use them
// });

// // Add a request interceptor to add the auth token from localStorage
// api.interceptors.request.use(
//     (config) => {
//         const token = localStorage.getItem('token');
//         if (token) {
//             config.headers.Authorization = `Bearer ${token}`;
//         }
//         return config;
//     },
//     (error) => {
//         return Promise.reject(error);
//     }
// );

// api.interceptors.response.use(
//     (response) => response,
//     (error) => {
//         if (error.response?.status === 401) {
//             // Optional: Auto logout if 401 occurs
//             // But we handle this in the UI usually
//         }
//         return Promise.reject(error);
//     }
// );

// export default api;



import axios from 'axios';
import { toast } from 'react-toastify';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    withCredentials: true,
});

// 🔥 REQUEST INTERCEPTOR (auth token)
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// 🔥 RESPONSE INTERCEPTOR (GLOBAL FEEDBACK)
api.interceptors.response.use(
    (response) => {
        // ✅ SUCCESS TOAST (only for mutating requests)
        const method = response.config.method;

        if (
            ['post', 'put', 'patch', 'delete'].includes(method) &&
            response.data?.message &&
            response.config?.showToast !== false // optional control
        ) {
            toast.success(response.data.message);
        }

        return response;
    },

    (error) => {
        // ❌ ERROR HANDLING
        const status = error.response?.status;

        const message =
            error.response?.data?.message ||
            error.message ||
            'Something went wrong';

        // 🔥 Auto logout on 401
        if (status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }

        // 🔥 ERROR TOAST
        if (error.config?.showToast !== false) {
            toast.error(message);
        }

        return Promise.reject(error);
    }
);

export default api;