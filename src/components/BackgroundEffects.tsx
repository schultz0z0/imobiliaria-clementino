import React from 'react';
import { motion } from 'motion/react';

export const BackgroundEffects = () => (
  <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
    <motion.div 
      animate={{ 
        x: [0, 50, -50, 0], 
        y: [0, -50, 50, 0],
        scale: [1, 1.1, 0.9, 1]
      }}
      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      className="absolute top-[-10%] right-[-5%] w-[350px] h-[350px] md:w-[800px] md:h-[800px] bg-[#d7b661] rounded-full blur-[60px] md:blur-[120px] opacity-10 transform-gpu will-change-transform" 
    />
    <motion.div 
      animate={{ 
        x: [0, -60, 40, 0], 
        y: [0, 60, -40, 0],
        scale: [1, 0.9, 1.1, 1]
      }}
      transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      className="absolute top-[20%] left-[-10%] w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-[#ffffff] rounded-full blur-[60px] md:blur-[120px] opacity-5 transform-gpu will-change-transform" 
    />
  </div>
);
