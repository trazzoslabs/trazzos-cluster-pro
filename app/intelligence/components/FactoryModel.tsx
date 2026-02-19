'use client';

import { useRef, useEffect } from 'react';

interface FactoryModelProps {
  x: number;
  y: number;
  scale: number;
  color?: string;
}

export default function FactoryModel({ x, y, scale = 1, color = '#9aff8d' }: FactoryModelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const floatAnimationRef = useRef<number | null>(null);
  const floatOffset = useRef(0);

  useEffect(() => {
    // Animación de entrada (pop-in)
    if (containerRef.current) {
      containerRef.current.style.opacity = '0';
      containerRef.current.style.transform = `scale(0.7) translateY(0px)`;
      
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.transition = 'opacity 0.3s ease-out, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
          containerRef.current.style.opacity = '1';
          containerRef.current.style.transform = `scale(${scale}) translateY(0px)`;
        }
      }, 10);
    }

    // Animación de flotación continua
    const animate = () => {
      floatOffset.current += 0.01;
      if (containerRef.current) {
        const offsetY = Math.sin(floatOffset.current) * 2;
        const currentScale = scale;
        containerRef.current.style.transform = `scale(${currentScale}) translateY(${offsetY}px)`;
      }
      floatAnimationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (floatAnimationRef.current) {
        cancelAnimationFrame(floatAnimationRef.current);
      }
    };
  }, [scale]);

  return (
    <div
      ref={containerRef}
      className="absolute pointer-events-none"
      style={{
        left: `${x - 30}px`,
        top: `${y - 40}px`,
        transformOrigin: 'center center',
      }}
    >
      {/* Fábrica 3D simplificada usando CSS */}
      <div className="relative" style={{ width: '60px', height: '80px' }}>
        {/* Base rectangular */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{
            width: '50px',
            height: '40px',
            backgroundColor: color,
            opacity: 0.9,
            transform: 'perspective(200px) rotateX(15deg)',
            boxShadow: `0 0 20px ${color}, 0 0 40px ${color}40`,
          }}
        />
        
        {/* Techo triangular */}
        <div
          className="absolute bottom-[40px] left-1/2 -translate-x-1/2"
          style={{
            width: 0,
            height: 0,
            borderLeft: '25px solid transparent',
            borderRight: '25px solid transparent',
            borderBottom: `30px solid ${color}`,
            filter: `drop-shadow(0 0 10px ${color})`,
          }}
        />

        {/* Chimenea */}
        <div
          className="absolute bottom-[65px] left-1/2 -translate-x-1/2"
          style={{
            width: '8px',
            height: '15px',
            backgroundColor: color,
            opacity: 0.8,
            boxShadow: `0 0 8px ${color}`,
          }}
        />

        {/* Ventana/Luz */}
        <div
          className="absolute bottom-[20px] left-1/2 -translate-x-1/2"
          style={{
            width: '12px',
            height: '12px',
            backgroundColor: color,
            borderRadius: '2px',
            boxShadow: `0 0 15px ${color}, 0 0 30px ${color}80`,
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}

