import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { 
  BookOpenIcon, 
  PencilSquareIcon, 
  BoltIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const Home = () => {
  const { isAuthenticated, user } = useAuth();

  const features = [
    {
      icon: BookOpenIcon,
      title: 'Learn',
      description: 'Access high-quality courses created by expert instructors. Track your progress and earn certificates.',
      color: 'text-blue-600'
    },
    {
      icon: PencilSquareIcon,
      title: 'Create',
      description: 'Share your expertise by creating engaging courses. Apply to become a creator and reach learners worldwide.',
      color: 'text-green-600'
    },
    {
      icon: BoltIcon,
      title: 'Grow',
      description: 'Build your skills, advance your career, and achieve your learning goals with our comprehensive platform.',
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <motion.div 
        className="text-center py-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Badge variant="primary" size="lg" className="mb-6">
            🚀 Modern Learning Platform
          </Badge>
        </motion.div>

        <motion.h1 
          className="text-6xl font-bold text-gray-900 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Welcome to{' '}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            MicroCourses
          </span>
        </motion.h1>
        
        <motion.p 
          className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          A modern learning management system where creators can share knowledge and learners can grow their skills through engaging courses.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {!isAuthenticated ? (
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="group">
                  Get Started
                  <ArrowRightIcon className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/courses">
                <Button variant="outline" size="lg">
                  Browse Courses
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/courses">
                <Button size="lg">
                  Browse Courses
                </Button>
              </Link>
              {user?.role === 'learner' && (
                <Link to="/progress">
                  <Button variant="outline" size="lg">
                    My Progress
                  </Button>
                </Link>
              )}
              {user?.role === 'creator' && (
                <Link to="/creator/dashboard">
                  <Button variant="outline" size="lg">
                    Creator Dashboard
                  </Button>
                </Link>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Features Section */}
      <motion.div 
        className="py-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
              >
                <Card hover className="h-full text-center group">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-200">
                    <Icon className={`w-8 h-8 ${feature.color}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Stats Section */}
      <motion.div 
        className="py-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-8">Join Our Learning Community</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.9 }}
              >
                <div className="text-4xl font-bold mb-2">1000+</div>
                <div className="text-indigo-100">Active Learners</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 1.0 }}
              >
                <div className="text-4xl font-bold mb-2">50+</div>
                <div className="text-indigo-100">Expert Creators</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 1.1 }}
              >
                <div className="text-4xl font-bold mb-2">200+</div>
                <div className="text-indigo-100">Courses Available</div>
              </motion.div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* CTA Section */}
      {!isAuthenticated && (
        <motion.div 
          className="text-center py-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-gray-50 to-indigo-50 border-indigo-200">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ready to Start Learning?
            </h2>
            <p className="text-gray-600 mb-8 text-lg">
              Join thousands of learners and creators in our community.
            </p>
            <Link to="/register">
              <Button size="lg">
                Sign Up Now
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default Home;