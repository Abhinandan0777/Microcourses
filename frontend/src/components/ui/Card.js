import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const Card = ({ 
  children, 
  className = '', 
  hover = false, 
  padding = 'md',
  ...props 
}) => {
  const baseClasses = 'bg-white rounded-xl shadow-sm border border-gray-200';
  
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const classes = clsx(
    baseClasses,
    paddings[padding],
    {
      'hover:shadow-md transition-shadow duration-200': hover
    },
    className
  );

  const MotionCard = hover ? motion.div : 'div';
  const motionProps = hover ? {
    whileHover: { y: -2 },
    transition: { duration: 0.2 }
  } : {};

  return (
    <MotionCard className={classes} {...motionProps} {...props}>
      {children}
    </MotionCard>
  );
};

export default Card;