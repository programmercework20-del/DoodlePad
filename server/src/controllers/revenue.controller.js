import { Ad, Payment } from '../models/index.js';
import { calculateRevenue } from './ad.controller.js';

const formatAdRevenue = (ad) => {
    const revenue = calculateRevenue(ad);

    return {
        id: ad.id,
        title: ad.title,
        type: ad.type,
        status: ad.status,
        budget: Number(ad.budget || 0),
        impressions: Number(ad.impressions || 0),
        clicks: Number(ad.clicks || 0),
        ...revenue
    };
};

export const getRevenueOverview = async (req, res) => {
    try {
        const ads = await Ad.findAll({
            include: [{
                model: Payment,
                as: 'payments',
                attributes: ['id', 'amount', 'paymentStatus']
            }],
            order: [['createdAt', 'DESC']]
        });

        const revenueByAd = ads.map(formatAdRevenue);
        const totals = revenueByAd.reduce((acc, ad) => ({
            totalRevenue: acc.totalRevenue + ad.totalRevenue,
            totalClicks: acc.totalClicks + ad.clicks,
            totalImpressions: acc.totalImpressions + ad.impressions
        }), {
            totalRevenue: 0,
            totalClicks: 0,
            totalImpressions: 0
        });

        const totalPaid = ads.reduce((sum, ad) => (
            sum + ad.payments
                .filter((payment) => payment.paymentStatus === 'success')
                .reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0)
        ), 0);

        const topPerformingAds = [...revenueByAd]
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, 5);

        res.json({
            success: true,
            data: {
                totalRevenue: totals.totalRevenue,
                totalClicks: totals.totalClicks,
                totalImpressions: totals.totalImpressions,
                totalPaid,
                ctr: totals.totalImpressions > 0
                    ? (totals.totalClicks / totals.totalImpressions) * 100
                    : 0,
                topPerformingAds,
                ads: revenueByAd
            }
        });
    } catch (error) {
        console.error('Revenue overview error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getRevenueByAdId = async (req, res) => {
    try {
        const ad = await Ad.findByPk(req.params.id, {
            include: [{
                model: Payment,
                as: 'payments',
                attributes: ['id', 'amount', 'paymentStatus', 'transactionId', 'createdAt']
            }]
        });

        if (!ad) {
            return res.status(404).json({ success: false, message: 'Ad not found' });
        }

        const revenue = formatAdRevenue(ad);
        const successfulPayments = ad.payments
            .filter((payment) => payment.paymentStatus === 'success')
            .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

        res.json({
            success: true,
            data: {
                ...revenue,
                totalPaid: successfulPayments,
                payments: ad.payments.map((payment) => ({
                    ...payment.toJSON(),
                    amount: Number(payment.amount || 0)
                }))
            }
        });
    } catch (error) {
        console.error('Revenue by ad error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
