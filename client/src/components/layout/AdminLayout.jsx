import { useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';

export default function AdminLayout({ children }) {
    const mainRef = useRef(null);
    const contentRef = useRef(null);

    useEffect(() => {
        if (!mainRef.current) return;

        // Initialize Lenis on the specific container
        const lenis = new Lenis({
            wrapper: mainRef.current, // The scrollable container
            content: contentRef.current, // The content inside
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            smoothTouch: false, // Often better false for containers on touch devices
            gestureOrientation: 'vertical',
            normalizeWheel: true,
        });

        // Loop
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        // Sync GSAP
        gsap.ticker.add((time) => {
            lenis.raf(time * 1000);
        });

        return () => {
            lenis.destroy();
            gsap.ticker.remove(lenis.raf);
        };
    }, []);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <Header />
                {/* 
                      Wrapper needs to be the one with overflow-y-auto.
                      We give it a ref for Lenis to control.
                    */}
                <main
                    ref={mainRef}
                    className="flex-1 overflow-y-auto p-6 relative w-full"
                >
                    {/* Content wrapper for Lenis calculations */}
                    <div ref={contentRef}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
