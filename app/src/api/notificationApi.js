import api from "./axios";

// 앱 안 알림함 API. 다른 API와 같은 규약으로 userId를 쿼리로 실어 보낸다.
export const notificationApi = {
    list: async (userId, limit = 50) => {
        const response = await api.get("/notification", { params: { userId, limit } });
        return response.data; // { items, unreadCount }
    },

    unreadCount: async (userId) => {
        const response = await api.get("/notification/unread-count", { params: { userId } });
        return response.data.unreadCount;
    },

    markRead: async (userId, notiId) => {
        const response = await api.post(`/notification/${notiId}/read`, null, { params: { userId } });
        return response.data.unreadCount;
    },

    markAllRead: async (userId) => {
        await api.post("/notification/read-all", null, { params: { userId } });
    },

    remove: async (userId, notiId) => {
        const response = await api.delete(`/notification/${notiId}`, { params: { userId } });
        return response.data.unreadCount;
    },
};

export default notificationApi;
