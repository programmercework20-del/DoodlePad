import api from "./api";

export const adService = {

  createAd: (formData) =>
    api.post("/ads", formData),

  getAds: () =>
    api.get("/ads"),

  deleteAd: (id) =>
    api.delete(`/ads/${id}`)

};