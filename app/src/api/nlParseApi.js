import api from "./axios";

export const nlParseApi = {

    // type: "IN"(수입) | "OUT"(지출, 기본값)
    parse: async ({ userId, text, type = 'OUT' }) => {
        const response = await api.post('/nlparse/parse', { userId, text, type });
        return response.data;
    },

    learn: async ({ userId, merchant, category, type = 'OUT' }) => {
        const response = await api.post('/nlparse/learn', { userId, merchant, category, type });
        return response.data;
    },
};

export default nlParseApi;
