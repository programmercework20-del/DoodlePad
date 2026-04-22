import { Op } from 'sequelize';
import { Ad, Payment } from '../models/index.js';

const AD_TYPES = ['banner', 'feed', 'popup'];
const AD_STATUSES = ['draft', 'active', 'inactive', 'pending_payment'];

const isValidUrl = (value) => {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
};

const calculateRevenue = (ad) => {
    const impressions = Number(ad.impressions || 0);
    const clicks = Number(ad.clicks || 0);
    const cpcRevenue = clicks * 5;
    const cpmRevenue = (impressions / 1000) * 100;

    return {
        cpcRevenue,
        cpmRevenue,
        totalRevenue: cpcRevenue + cpmRevenue,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0
    };
};

const validateAdPayload = (payload) => {
    const errors = [];
    const startDate = payload.startDate ? new Date(payload.startDate) : null;
    const endDate = payload.endDate ? new Date(payload.endDate) : null;

    if (!payload.title?.trim()) errors.push('Title is required.');
    if (!payload.description?.trim()) errors.push('Description is required.');
    if (!payload.imageUrl?.trim() || !isValidUrl(payload.imageUrl)) {
        errors.push('A valid image URL is required.');
    }
    if (!payload.redirectUrl?.trim() || !isValidUrl(payload.redirectUrl)) {
        errors.push('A valid redirect URL is required.');
    }
    if (!AD_TYPES.includes(payload.type)) errors.push('Ad type is invalid.');
    if (Number(payload.budget) <= 0) errors.push('Budget must be greater than 0.');
    if (!(startDate instanceof Date) || Number.isNaN(startDate?.getTime())) {
        errors.push('Start date is invalid.');
    }
    if (!(endDate instanceof Date) || Number.isNaN(endDate?.getTime())) {
        errors.push('End date is invalid.');
    }
    if (startDate && endDate && startDate >= endDate) {
        errors.push('Start date must be before end date.');
    }

    return errors;
};

const shapeAdResponse = (ad) => {
    const revenue = calculateRevenue(ad);
    const successfulPayments = ad.payments?.filter((payment) => payment.paymentStatus === 'success') || [];

    return {
        ...ad.toJSON(),
        budget: Number(ad.budget || 0),
        revenue,
        hasSuccessfulPayment: successfulPayments.length > 0,
        latestPayment: ad.payments?.[0] || null
    };
};

export const createAd = async (req, res) => {
    try {
        const payload = req.body;
        const errors = validateAdPayload(payload);

        if (errors.length) {
            return res.status(400).json({ success: false, message: errors[0], errors });
        }

        const ad = await Ad.create({
            title: payload.title.trim(),
            description: payload.description.trim(),
            imageUrl: payload.imageUrl.trim(),
            redirectUrl: payload.redirectUrl.trim(),
            type: payload.type,
            budget: Number(payload.budget),
            startDate: payload.startDate,
            endDate: payload.endDate,
            status: 'pending_payment'
        });

        res.status(201).json({
            success: true,
            message: 'Ad created successfully.',
            data: ad
        });
    } catch (error) {
        console.error('Create ad error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getAllAds = async (req, res) => {
    try {
        const { search, status, type, page = 1, limit = 10 } = req.query;
        const parsedPage = Number(page) || 1;
        const parsedLimit = Number(limit) || 10;
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {};
        if (status && AD_STATUSES.includes(status)) where.status = status;
        if (type && AD_TYPES.includes(type)) where.type = type;
        if (search) {
            where[Op.or] = [
                { title: { [Op.iLike]: `%${search}%` } },
                { description: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const { count, rows } = await Ad.findAndCountAll({
            where,
            limit: parsedLimit,
            offset,
            order: [['createdAt', 'DESC']],
            include: [{
                model: Payment,
                as: 'payments',
                attributes: ['id', 'amount', 'paymentStatus', 'transactionId', 'createdAt'],
                separate: true,
                limit: 1,
                order: [['createdAt', 'DESC']]
            }]
        });

        res.json({
            success: true,
            data: {
                ads: rows.map(shapeAdResponse),
                pagination: {
                    total: count,
                    page: parsedPage,
                    limit: parsedLimit,
                    pages: Math.ceil(count / parsedLimit)
                }
            }
        });
    } catch (error) {
        console.error('Get ads error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getAdById = async (req, res) => {
    try {
        const ad = await Ad.findByPk(req.params.id, {
            include: [{
                model: Payment,
                as: 'payments',
                attributes: ['id', 'amount', 'paymentStatus', 'transactionId', 'createdAt'],
                order: [['createdAt', 'DESC']]
            }]
        });

        if (!ad) {
            return res.status(404).json({ success: false, message: 'Ad not found' });
        }

        res.json({
            success: true,
            data: shapeAdResponse(ad)
        });
    } catch (error) {
        console.error('Get ad by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const updateAd = async (req, res) => {
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

        const payload = req.body;
        const errors = validateAdPayload(payload);

        if (errors.length) {
            return res.status(400).json({ success: false, message: errors[0], errors });
        }

        const hasSuccessfulPayment = ad.payments.some((payment) => payment.paymentStatus === 'success');
        const nextStatus = hasSuccessfulPayment ? ad.status : 'pending_payment';

        await ad.update({
            title: payload.title.trim(),
            description: payload.description.trim(),
            imageUrl: payload.imageUrl.trim(),
            redirectUrl: payload.redirectUrl.trim(),
            type: payload.type,
            budget: Number(payload.budget),
            startDate: payload.startDate,
            endDate: payload.endDate,
            status: nextStatus
        });

        res.json({
            success: true,
            message: 'Ad updated successfully.',
            data: ad
        });
    } catch (error) {
        console.error('Update ad error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const deleteAd = async (req, res) => {
    try {
        const ad = await Ad.findByPk(req.params.id);

        if (!ad) {
            return res.status(404).json({ success: false, message: 'Ad not found' });
        }

        await ad.destroy();

        res.json({
            success: true,
            message: 'Ad deleted successfully.'
        });
    } catch (error) {
        console.error('Delete ad error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const toggleAdStatus = async (req, res) => {
    try {
        const ad = await Ad.findByPk(req.params.id, {
            include: [{
                model: Payment,
                as: 'payments',
                attributes: ['id', 'paymentStatus']
            }]
        });

        if (!ad) {
            return res.status(404).json({ success: false, message: 'Ad not found' });
        }

        const hasSuccessfulPayment = ad.payments.some((payment) => payment.paymentStatus === 'success');
        if (!hasSuccessfulPayment) {
            return res.status(400).json({
                success: false,
                message: 'Ad cannot be activated without a successful payment.'
            });
        }

        const nextStatus = ad.status === 'active' ? 'inactive' : 'active';

        // Check for expiration if trying to activate
        if (nextStatus === 'active' && new Date(ad.endDate) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Ad has expired and cannot be activated. Please update the end date first.'
            });
        }

        ad.status = nextStatus;
        await ad.save();

        res.json({
            success: true,
            message: `Ad ${nextStatus === 'active' ? 'activated' : 'deactivated'} successfully.`,
            data: ad
        });
    } catch (error) {
        console.error('Toggle ad error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const trackAdView = async (req, res) => {
    try {
        const ad = await Ad.findByPk(req.params.id);

        if (!ad) {
            return res.status(404).json({ success: false, message: 'Ad not found' });
        }

        await ad.increment('impressions', { by: 1 });
        await ad.reload();

        res.json({
            success: true,
            message: 'Ad impression tracked.',
            data: {
                impressions: ad.impressions,
                revenue: calculateRevenue(ad)
            }
        });
    } catch (error) {
        console.error('Track view error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const trackAdClick = async (req, res) => {
    try {
        const ad = await Ad.findByPk(req.params.id);

        if (!ad) {
            return res.status(404).json({ success: false, message: 'Ad not found' });
        }

        await ad.increment('clicks', { by: 1 });
        await ad.reload();

        res.json({
            success: true,
            message: 'Ad click tracked.',
            data: {
                clicks: ad.clicks,
                revenue: calculateRevenue(ad)
            }
        });
    } catch (error) {
        console.error('Track click error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export { calculateRevenue };
