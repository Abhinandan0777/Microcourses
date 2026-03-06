import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import LessonPlayer from './pages/LessonPlayer';
import Progress from './pages/Progress';
import CreatorApply from './pages/CreatorApply';
import CreatorDashboard from './pages/CreatorDashboard';
import AdminReview from './pages/AdminReview';
import ProtectedRoute from './components/ProtectedRoute';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={
              <Layout>
                <Home />
              </Layout>
            } />
            <Route path="/courses" element={
              <Layout>
                <Courses />
              </Layout>
            } />
            <Route 
              path="/courses/:id" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <CourseDetail />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/learn/:lessonId" 
              element={
                <ProtectedRoute roles={['learner']}>
                  <Layout>
                    <LessonPlayer />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/progress" 
              element={
                <ProtectedRoute roles={['learner']}>
                  <Layout>
                    <Progress />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/creator/apply" 
              element={
                <ProtectedRoute roles={['creator']}>
                  <Layout>
                    <CreatorApply />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/creator/dashboard" 
              element={
                <ProtectedRoute roles={['creator']}>
                  <Layout>
                    <CreatorDashboard />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/review" 
              element={
                <ProtectedRoute roles={['admin']}>
                  <Layout>
                    <AdminReview />
                  </Layout>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;