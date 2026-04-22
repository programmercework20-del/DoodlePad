import { Ad, Payment } from '../models/index.js';

const generateTransactionId = () => `MOCK-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

export const simulatePayment = async (req, res) => {
    try {
        const { adId, amount } = req.body;

        if (!adId) {
            return res.status(400).json({ success: false, message: 'Ad ID is required.' });
        }

        const ad = await Ad.findByPk(adId);
        if (!ad) {
            return res.status(404).json({ success: false, message: 'Ad not found.' });
        }

        const paymentAmount = Number(amount || ad.budget);
        if (paymentAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0.' });
        }

        const payment = await Payment.create({
            adId,
            amount: paymentAmount,
            paymentStatus: 'success',
            transactionId: generateTransactionId()
        });

        ad.status = 'active';
        await ad.save();

        res.status(201).json({
            success: true,
            message: 'Mock payment completed successfully.',
            data: payment
        });
    } catch (error) {
        console.error('Simulate payment error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getAllPayments = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows } = await Payment.findAndCountAll({
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [{
                model: Ad,
                as: 'ad',
                attributes: ['id', 'title', 'type', 'status']
            }]
        });

        res.json({
            success: true,
            data: {
                payments: rows.map((payment) => ({
                    ...payment.toJSON(),
                    amount: Number(payment.amount || 0)
                })),
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
