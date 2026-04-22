import { Ad } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Automatically deactivates ads that have reached their end date.
 * This runs periodically to ensure the database status matches reality.
 */
export const cleanupExpiredAds = async () => {
    try {
        const now = new Date();
        const [updatedCount] = await Ad.update(
            { status: 'inactive' },
            {
                where: {
                    status: 'active',
                    endDate: {
                        [Op.lt]: now
                    }
                }
            }
        );

        if (updatedCount > 0) {
            console.log(`[AdCleanup] Auto-deactivated ${updatedCount} expired ads.`);
        }
    } catch (error) {
        console.error('[AdCleanup] Error deactivating expired ads:', error);
    }
};

/**
 * Starts the periodic cleanup task.
 * Default interval is 1 hour.
 */
export const startAdCleanupTask = (intervalMs = 3600000) => {
    console.log('🚀 Ad cleanup task scheduled.');
    
    // Run immediately on start
    cleanupExpiredAds();

    // Then run at intervals
    setInterval(cleanupExpiredAds, intervalMs);
};
