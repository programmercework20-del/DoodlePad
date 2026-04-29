import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function PageAnimation({ children, className = "" }) {
    const el = useRef(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            gsap.fromTo(
                el.current,
                { opacity: 0, y: 20 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.6,
                    ease: 'power3.out',
                    clearProps: 'all' // Clear styles after animation to avoid conflicts
                }
            );
        }, el.current);

        return () => ctx.revert();
    }, []);

    return (
        <div ref={el} className={`w-full ${className}`}>
            {children}
        </div>
    );
}
