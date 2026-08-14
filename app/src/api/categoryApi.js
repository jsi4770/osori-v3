import api from "./axios";

export const categoryApi = {

    list: async (userId, type) => {
        const response = await api.get(`/category/${userId}/${type}`);
        return response.data;
    },

    manage: async (userId, type) => {
        const response = await api.get(`/category/${userId}/${type}/manage`);
        return response.data;
    },

    add: async (userId, type, name) => {
        const response = await api.post('/category', { userId, type, name });
        return response.data;
    },

    remove: async (categoryId) => {
        const response = await api.delete(`/category/${categoryId}`);
        return response.data;
    },

    setHidden: async (userId, type, name, hidden) => {
        const response = await api.patch('/category/hidden', { userId, type, name, hidden });
        return response.data;
    },

}

export default categoryApi;
