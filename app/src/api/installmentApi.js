import api from "./axios";

export const installmentApi = {

    register: async (payload) => {
        const response = await api.post('/trans/installment/register', payload);
        return response.data;
    },

}

export default installmentApi;
