import api from "./axios";

export const pushApi = {
  // pushManager.subscribe()에 넘길 VAPID 공개키
  vapidPublicKey: async () => {
    const res = await api.get("/push/vapidPublicKey");
    return res.data; // { publicKey: "..." }
  },

  subscribe: async ({ userId, subscription }) => {
    const res = await api.post("/push/subscribe", { userId, subscription });
    return res.data;
  },

  unsubscribe: async ({ endpoint }) => {
    const res = await api.post("/push/unsubscribe", { endpoint });
    return res.data;
  },
};

export default pushApi;
