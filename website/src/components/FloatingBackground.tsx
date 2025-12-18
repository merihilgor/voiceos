import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

const FloatingBackground = () => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: e.clientX,
                y: e.clientY,
            });
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const { scrollY } = useScroll();
    const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
    const y2 = useTransform(scrollY, [0, 1000], [0, -150]);
    
    const mouseX = useSpring(mousePosition.x / 40, { damping: 50, stiffness: 400 });
    const mouseY = useSpring(mousePosition.y / 40, { damping: 50, stiffness: 400 });

    const dots = Array.from({ length: 40 });
    const blobs = Array.from({ length: 4 });

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Ambient Blobs */}
            {blobs.map((_, i) => (
                <motion.div
                    key={`blob-${i}`}
                    className="absolute rounded-full blur-[120px] opacity-20"
                    style={{
                        width: Math.random() * 400 + 200,
                        height: Math.random() * 400 + 200,
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        background: i % 2 === 0 ? 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' : 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
                        x: i % 2 === 0 ? mouseX : -mouseX,
                        y: i % 3 === 0 ? y1 : y2,
                    }}
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                    }}
                    transition={{
                        duration: 15 + i * 2,
                        repeat: Infinity,
                        ease: "linear"
                    }}
                />
            ))}

            {/* Antigravity Particles */}
            {dots.map((_, i) => {
                const size = Math.random() * 4 + 1;
                const initialX = Math.random() * 100;
                const initialY = Math.random() * 100;
                const duration = Math.random() * 10 + 20;

                return (
                    <motion.div
                        key={`dot-${i}`}
                        className="absolute rounded-full bg-blue-400/20"
                        style={{
                            width: size,
                            height: size,
                            left: `${initialX}%`,
                            top: `${initialY}%`,
                            x: mouseX,
                            y: mouseY,
                        }}
                        animate={{
                            y: [0, -100, 0],
                            x: [0, Math.random() * 50 - 25, 0],
                            opacity: [0.2, 0.5, 0.2],
                        }}
                        transition={{
                            duration: duration,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: Math.random() * 10,
                        }}
                    />
                );
            })}
        </div>
    );
};

export default FloatingBackground;
