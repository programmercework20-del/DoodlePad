import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * @param {string} [src]       - Image URL
 * @param {string} [name]      - Used for fallback initial and alt text
 * @param {string} [size]      - Tailwind size class (default 'h-10 w-10')
 * @param {string} [className] - Additional classes (e.g., 'rounded-2xl')
 */
export default function Avatar({ src, name, size = 'h-10 w-10', className }) {
    const [status, setStatus] = useState(src ? 'loading' : 'error');

    return (
        <div className={cn(
            'relative overflow-hidden bg-gray-200 flex items-center justify-center shrink-0',
            !className?.includes('rounded') && 'rounded-full', // Default to round if no rounded class provided
            size,
            className
        )}>
            {/* Skeleton shimmer — shown while image is loading */}
            {status === 'loading' && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse" />
            )}

            {/* Actual image — lazy loaded, hidden until ready */}
            {src && (
                <img
                    src={src}
                    alt={name ? `${name}'s photo` : 'Photo'}
                    loading="lazy"
                    onLoad={() => setStatus('loaded')}
                    onError={() => setStatus('error')}
                    className={cn(
                        'w-full h-full object-cover transition-opacity duration-300',
                        status === 'loaded' ? 'opacity-100' : 'opacity-0'
                    )}
                />
            )}

            {/* Fallback initial — shown when no src or image fails */}
            {status === 'error' && (
                <span className="text-sm font-bold uppercase text-gray-700 select-none">
                    {name?.charAt(0) ?? '?'}
                </span>
            )}
        </div>
    );
}
