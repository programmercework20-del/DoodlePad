import { useEffect } from 'react';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { useLocation } from 'react-router-dom';

export default function LenisProvider({ children }) {
    const { pathname } = useLocation();

    useEffect(() => {
        // Initialize Lenis
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Exponential easing
            smoothWheel: pathname !== '/login', // Disable on login page as requested
            smoothTouch: false,
        });

        // Loop for smooth scrolling
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        // Sync GSAP with Lenis
        gsap.ticker.add((time) => {
            lenis.raf(time * 1000);
        });

        // Disable lag smoothing for instant response
        gsap.ticker.lagSmoothing(0);

        // Scroll to top on route change
        lenis.scrollTo(0, { immediate: true });

        return () => {
            lenis.destroy();
            gsap.ticker.remove(lenis.raf);
        };
    }, [pathname]);

    return children;
}
