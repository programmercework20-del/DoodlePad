import express from 'express';
import adminAuth from '../middlewares/adminAuth.js';
import {
    createAd,
    deleteAd,
    getAdById,
    getAllAds,
    toggleAdStatus,
    trackAdClick,
    trackAdView,
    updateAd
} from '../controllers/ad.controller.js';

const router = express.Router();

router.use(adminAuth);
router.post('/', createAd);
router.get('/', getAllAds);
router.get('/:id', getAdById);
router.put('/:id', updateAd);
router.delete('/:id', deleteAd);
router.patch('/:id/toggle', toggleAdStatus);
router.post('/:id/view', trackAdView);
router.post('/:id/click', trackAdClick);

export default router;
