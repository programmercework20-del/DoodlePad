import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  Eye,
  MousePointerClick,
  Calendar,
  Trash2,
  Search,
  BadgeCheck,
  PauseCircle,
  PlayCircle,
  DollarSign
} from "lucide-react";

import AdminLayout from "@/components/layout/AdminLayout";

import {
  fetchAds,
  deleteAd
} from "@/store/slices/adSlice";

export default function Ads() {

  const dispatch = useDispatch();

  const {
    ads,
    loading
  } = useSelector(state => state.ads);

  const [search, setSearch] = useState("");

  useEffect(() => {
    dispatch(fetchAds());
  }, [dispatch]);

  const filteredAds = useMemo(() => {

    return ads.filter(ad =>
      ad.title?.toLowerCase().includes(search.toLowerCase()) ||
      ad.advertiserName?.toLowerCase().includes(search.toLowerCase())
    );

  }, [ads, search]);

  const totalRevenue = ads.reduce((acc, ad) => {
    return acc + (ad.budget || 0);
  }, 0);

  const totalClicks = ads.reduce((acc, ad) => {
    return acc + (ad.clicks || 0);
  }, 0);

  const totalImpressions = ads.reduce((acc, ad) => {
    return acc + (ad.impressions || 0);
  }, 0);

  const activeAds = ads.filter(ad => ad.status === "active").length;

  const handleDelete = (id) => {

    const confirmDelete =
      window.confirm("Delete this advertisement?");

    if (!confirmDelete) return;

    dispatch(deleteAd(id));

  };

  const isExpired = (endDate) => {

    if (!endDate) return false;

    return new Date(endDate) < new Date();

  };

  return (

    <AdminLayout>

      <div className="space-y-8">

        {/* HEADER */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          <div>

            <h1 className="text-4xl font-bold text-gray-900">
              Advertisement Management
            </h1>

            <p className="text-gray-500 mt-1">
              Manage sponsored campaigns and monetization
            </p>

          </div>

        </div>

        {/* ANALYTICS */}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

          <div className="bg-white rounded-2xl p-5 shadow-sm border">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Total Ads
                </p>

                <h2 className="text-3xl font-bold mt-2">
                  {ads.length}
                </h2>

              </div>

              <BadgeCheck className="w-8 h-8 text-blue-500" />

            </div>

          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Active Ads
                </p>

                <h2 className="text-3xl font-bold mt-2">
                  {activeAds}
                </h2>

              </div>

              <PlayCircle className="w-8 h-8 text-green-500" />

            </div>

          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Total Clicks
                </p>

                <h2 className="text-3xl font-bold mt-2">
                  {totalClicks}
                </h2>

              </div>

              <MousePointerClick className="w-8 h-8 text-purple-500" />

            </div>

          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Revenue
                </p>

                <h2 className="text-3xl font-bold mt-2">
                  ₹{totalRevenue}
                </h2>

              </div>

              <DollarSign className="w-8 h-8 text-orange-500" />

            </div>

          </div>

        </div>

        {/* SEARCH */}

        <div className="bg-white border rounded-2xl p-4 flex items-center gap-3">

          <Search className="text-gray-400 w-5 h-5" />

          <input
            type="text"
            placeholder="Search advertisement..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full outline-none"
          />

        </div>

        {/* ADS GRID */}

        {loading ? (

          <div className="text-center py-20 text-gray-500">
            Loading advertisements...
          </div>

        ) : (

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {filteredAds.map(ad => {

              const expired = isExpired(ad.endDate);

              return (

                <div
                  key={ad.id}
                  className="bg-white rounded-3xl overflow-hidden shadow-sm border hover:shadow-lg transition-all"
                >

                  {/* IMAGE */}

                  <div className="relative">

                    <div className="w-full h-64 bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center">
  <img
    src={ad.imageUrl}
    alt={ad.title}
    className="max-w-full max-h-full object-contain"
    onError={(e) => {
      e.target.src =
        "https://placehold.co/1200x628/png?text=Advertisement";
    }}
  />
</div>

                    <div className="absolute top-4 left-4 bg-black/80 text-white text-xs px-3 py-1 rounded-full">
                      Sponsored
                    </div>

                    <div className="absolute top-4 right-4">

                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${expired
                        ? "bg-red-100 text-red-600"
                        : ad.status === "active"
                          ? "bg-green-100 text-green-600"
                          : "bg-yellow-100 text-yellow-600"
                        }`}>

                        {expired
                          ? "Expired"
                          : ad.status}

                      </span>

                    </div>

                  </div>

                  {/* CONTENT */}

                  <div className="p-5 space-y-4">

                    <div>

                      <div className="flex items-center justify-between">

                        <h2 className="text-2xl font-bold text-gray-900">
                          {ad.title}
                        </h2>

                        <button
                          onClick={() => handleDelete(ad.id)}
                          className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>

                      </div>

                      <p className="text-gray-500 mt-2">
                        {ad.description}
                      </p>

                    </div>

                    {/* ADVERTISER */}

                    <div className="flex items-center justify-between">

                      <div>

                        <p className="text-xs text-gray-400">
                          Advertiser
                        </p>

                        <p className="font-semibold">
                          {ad.advertiserName}
                        </p>

                      </div>

                      <a
                        href={ad.redirectUrl}
                        target="_blank"
                        className="bg-black text-white px-4 py-2 rounded-xl text-sm"
                      >
                        Visit
                      </a>

                    </div>

                    {/* STATS */}

                    <div className="grid grid-cols-2 gap-4">

                      <div className="bg-gray-50 rounded-2xl p-4">

                        <div className="flex items-center gap-2 text-gray-500 text-sm">

                          <Eye className="w-4 h-4" />

                          Impressions

                        </div>

                        <h3 className="text-xl font-bold mt-2">
                          {ad.impressions}
                        </h3>

                      </div>

                      <div className="bg-gray-50 rounded-2xl p-4">

                        <div className="flex items-center gap-2 text-gray-500 text-sm">

                          <MousePointerClick className="w-4 h-4" />

                          Clicks

                        </div>

                        <h3 className="text-xl font-bold mt-2">
                          {ad.clicks}
                        </h3>

                      </div>

                    </div>

                    {/* DATES */}

                    <div className="flex items-center justify-between text-sm text-gray-500 border-t pt-4">

                      <div className="flex items-center gap-2">

                        <Calendar className="w-4 h-4" />

                        {ad.startDate
                          ? new Date(ad.startDate).toLocaleDateString()
                          : "No start date"}

                      </div>

                      <div>

                        →
                      </div>

                      <div>

                        {ad.endDate
                          ? new Date(ad.endDate).toLocaleDateString()
                          : "Unlimited"}

                      </div>

                    </div>

                  </div>

                </div>

              );

            })}

          </div>

        )}

      </div>

    </AdminLayout>

  );
}