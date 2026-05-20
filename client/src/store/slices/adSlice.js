import {
  createSlice,
  createAsyncThunk
} from "@reduxjs/toolkit";

import { adService } from "@/services/ad.service";

export const fetchAds = createAsyncThunk(
  "ads/fetchAds",
  async (_, thunkAPI) => {
    try {

      const response =
        await adService.getAds();

      return response.data.ads;

    } catch (error) {

      return thunkAPI.rejectWithValue(
        error.response?.data?.message
      );

    }
  }
);

export const createAd = createAsyncThunk(
  "ads/createAd",
  async (formData, thunkAPI) => {

    try {

      const response =
        await adService.createAd(formData);

      return response.data.ad;

    } catch (error) {

      return thunkAPI.rejectWithValue(
        error.response?.data?.message
      );

    }
  }
);

export const deleteAd = createAsyncThunk(
  "ads/deleteAd",
  async (id, thunkAPI) => {

    try {

      await adService.deleteAd(id);

      return id;

    } catch (error) {

      return thunkAPI.rejectWithValue(
        error.response?.data?.message
      );

    }

  }
);


const adSlice = createSlice({
  name: "ads",

  initialState: {
    ads: [],
    loading: false,
    error: null
  },

  reducers: {},

  extraReducers: (builder) => {

    builder

      .addCase(fetchAds.pending, (state) => {
        state.loading = true;
      })

      .addCase(fetchAds.fulfilled, (state, action) => {
        state.loading = false;
        state.ads = action.payload;
      })

      .addCase(fetchAds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(createAd.fulfilled, (state, action) => {
        state.ads.unshift(action.payload);
      })

      .addCase(deleteAd.fulfilled, (state, action) => {
        state.ads =
          state.ads.filter(
            ad => ad.id !== action.payload
          );

      });
}
});
export default adSlice.reducer;