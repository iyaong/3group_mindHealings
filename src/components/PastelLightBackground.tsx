import { motion } from 'framer-motion';
import './PastelLightBackground.css';

export default function PastelLightBackground() {
  const lights = [
    {
      id: 1,
      color: 'radial-gradient(circle, rgba(167, 139, 250, 0.85) 0%, rgba(196, 181, 253, 0.7) 20%, rgba(224, 231, 255, 0.4) 40%, rgba(237, 233, 254, 0.15) 60%, transparent 70%)',
      size: 1100,
      orbitRadius: 250,
      blur: 45,
      direction: -1,
      speed: 15,
    },
    {
      id: 2,
      color: 'radial-gradient(circle, rgba(244, 114, 182, 0.9) 0%, rgba(251, 207, 232, 0.75) 20%, rgba(252, 231, 243, 0.45) 40%, rgba(253, 230, 245, 0.15) 60%, transparent 70%)',
      size: 1300,
      orbitRadius: 50,
      blur: 48,
      direction: 1,
      speed: 30,
    },
    {
      id: 3,
      color: 'radial-gradient(circle, rgba(251, 207, 232, 0.85) 0%, rgba(254, 215, 226, 0.7) 20%, rgba(252, 231, 243, 0.4) 40%, rgba(253, 230, 245, 0.15) 60%, transparent 70%)',
      size: 1400,
      orbitRadius: 30,
      blur: 50,
      direction: 1,
      speed: 35,
    },
    {
      id: 4,
      color: 'radial-gradient(circle, rgba(196, 181, 253, 0.8) 0%, rgba(221, 214, 254, 0.65) 20%, rgba(237, 233, 254, 0.35) 40%, rgba(224, 231, 255, 0.15) 60%, transparent 70%)',
      size: 1000,
      orbitRadius: 350,
      blur: 42,
      direction: -1,
      speed: 18,
    },
    {
      id: 5,
      color: 'radial-gradient(circle, rgba(248, 180, 217, 0.8) 0%, rgba(251, 207, 232, 0.65) 20%, rgba(253, 230, 245, 0.35) 40%, rgba(252, 231, 243, 0.15) 60%, transparent 70%)',
      size: 1200,
      orbitRadius: 80,
      blur: 46,
      direction: 1,
      speed: 40,
    },
    {
      id: 6,
      color: 'radial-gradient(circle, rgba(139, 92, 246, 0.85) 0%, rgba(167, 139, 250, 0.7) 20%, rgba(196, 181, 253, 0.4) 40%, rgba(224, 231, 255, 0.15) 60%, transparent 70%)',
      size: 1100,
      orbitRadius: 220,
      blur: 44,
      direction: 1,
      speed: 22,
    }
  ];

  return (
    <div className="pastel-light-container">
      {lights.map((light, index) => {
        const startAngle = index * 72;
        const endAngle = startAngle + (360 * light.direction);
        
        return (
          <motion.div
            key={light.id}
            className="orbit-container"
            style={{
              left: '50%',
              top: '50%',
            }}
            animate={{
              rotate: [startAngle, endAngle],
            }}
            transition={{
              duration: light.speed,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <div
              className="pastel-light"
              style={{
                background: light.color,
                width: `${light.size}px`,
                height: `${light.size}px`,
                filter: `blur(${light.blur}px)`,
                transform: `translate(${light.orbitRadius}px, 0)`,
              }}
            />
          </motion.div>
        );
      })}
      
      {/* 추가 빛 효과 레이어 */}
      <motion.div
        className="pastel-glow-overlay"
        animate={{
          opacity: [0.3, 0.5, 0.35, 0.45, 0.3],
          scale: [1, 1.05, 0.98, 1.03, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  );
}
