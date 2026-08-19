import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

export function Reveal({ children, delay = 0, className, direction = 'up' }: { children: ReactNode, delay?: number, className?: string, direction?: 'up' | 'down' | 'left' | 'right' }) {
  
  const yOffset = direction === 'up' ? 30 : direction === 'down' ? -30 : 0;
  const xOffset = direction === 'left' ? 30 : direction === 'right' ? -30 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset, x: xOffset }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
