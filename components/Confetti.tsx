import React, { useEffect, useRef } from 'react';

interface ConfettiProps {
  active: boolean;
  onComplete: () => void;
}

const Confetti: React.FC<ConfettiProps> = ({ active, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: any[] = [];
    const colors = ['#0052CC', '#FF5252', '#FFC107', '#4CAF50', '#00B8D9'];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight,
        w: Math.random() * 10 + 5,
        h: Math.random() * 10 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 20,
        vy: -Math.random() * 20 - 10,
        grav: 0.5
      });
    }

    let animationId: number;

    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let activeParticles = 0;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.grav;

        if (p.y < canvas.height) {
            activeParticles++;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.w, p.h);
        }
      });

      if (activeParticles > 0) {
        animationId = requestAnimationFrame(draw);
      } else {
        onComplete();
      }
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
};

export default Confetti;