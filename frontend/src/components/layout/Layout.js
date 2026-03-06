import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../Navbar';
import Toast from '../ui/Toast';

const Layout = ({ children, className = '' }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <motion.main 
        className={`container mx-auto px-4 py-8 ${className}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.main>
      <Toast />
    </div>
  );
};

export default Layout;