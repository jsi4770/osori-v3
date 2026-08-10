import api from "./axios";

export const nlParseApi = {

    parse: async ({ userId, text }) => {
        const response = await api.post('/nlparse/parse', { userId, text });
        return response.data;
    },

    learn: async ({ userId, merchant, category }) => {
        const response = await api.post('/nlparse/learn', { userId, merchant, category });
        return response.data;
    },
};

export default nlParseApi;
