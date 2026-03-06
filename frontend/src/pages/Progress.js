import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const Progress = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingCert, setGeneratingCert] = useState(null);

  const fetchProgress = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await axios.get(`/api/users/${user.id}/progress`);
      setProgress(response.data);
    } catch (err) {
      setError('Failed to load progress');
      console.error('Error fetching progress:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchCertificates = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await axios.get(`/api/certificates/user/${user.id}`);
      setCertificates(response.data.certificates);
    } catch (err) {
      console.error('Error fetching certificates:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProgress();
      fetchCertificates();
      
      // FIX ISSUE 2: Auto-refresh progress every 30 seconds to show real-time updates
      const interval = setInterval(() => {
        fetchProgress();
        fetchCertificates();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user, fetchProgress, fetchCertificates]);

  const generateCertificate = async (courseId) => {
    setGeneratingCert(courseId);
    try {
      await axios.post(`/api/courses/${courseId}/certificate`);
      
      // Refresh certificates
      await fetchCertificates();
      
      // Show success message or download certificate
      alert('Certificate generated successfully!');
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to generate certificate';
      alert(errorMsg);
    } finally {
      setGeneratingCert(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load Progress</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <Link to="/courses" className="btn-primary">
          Browse Courses
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My Learning Progress</h1>

      {/* Overview Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="card text-center">
          <div className="text-3xl font-bold text-primary-600 mb-2">
            {progress.totalEnrollments}
          </div>
          <div className="text-gray-600">Enrolled Courses</div>
        </div>
        
        <div className="card text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {progress.totalCompletedLessons}
          </div>
          <div className="text-gray-600">Lessons Completed</div>
        </div>
        
        <div className="card text-center">
          <div className="text-3xl font-bold text-purple-600 mb-2">
            {certificates.length}
          </div>
          <div className="text-gray-600">Certificates Earned</div>
        </div>
      </div>

      {/* Enrolled Courses */}
      <div className="card mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Enrolled Courses</h2>
        
        {progress.courses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">You haven't enrolled in any courses yet.</p>
            <Link to="/courses" className="btn-primary">
              Browse Courses
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {progress.courses.map((course) => (
              <CourseProgressCard
                key={course.courseId}
                course={course}
                onGenerateCertificate={generateCertificate}
                generatingCert={generatingCert}
                hasCertificate={certificates.some(cert => cert.course.id === course.courseId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Certificates */}
      {certificates.length > 0 && (
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">My Certificates</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            {certificates.map((certificate) => (
              <CertificateCard key={certificate.certificateId} certificate={certificate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CourseProgressCard = ({ course, onGenerateCertificate, generatingCert, hasCertificate }) => {
  const isComplete = course.percentage === 100;
  const canGenerateCert = isComplete && !hasCertificate;

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{course.title}</h3>
          <p className="text-gray-600 mb-2">{course.description}</p>
          <div className="text-sm text-gray-500">
            Enrolled on {new Date(course.enrolledAt).toLocaleDateString()}
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-primary-600 mb-1">
            {course.percentage}%
          </div>
          <div className="text-sm text-gray-500">
            {course.completedLessons} / {course.totalLessons} lessons
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-bar mb-4">
        <div 
          className="progress-fill" 
          style={{ width: `${course.percentage}%` }}
        ></div>
      </div>

      <div className="flex justify-between items-center">
        <Link 
          to={`/courses/${course.courseId}`}
          className="btn-secondary"
        >
          Continue Learning
        </Link>

        {canGenerateCert && (
          <button
            onClick={() => onGenerateCertificate(course.courseId)}
            disabled={generatingCert === course.courseId}
            className="btn-primary"
          >
            {generatingCert === course.courseId ? 'Generating...' : 'Get Certificate'}
          </button>
        )}

        {hasCertificate && (
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
            ✓ Certified
          </span>
        )}
      </div>
    </div>
  );
};

const CertificateCard = ({ certificate }) => {
  const handleDownload = () => {
    window.open(`/api/certificates/download/${certificate.serial}`, '_blank');
  };

  const handleVerify = () => {
    window.open(`/api/certificates/verify/${certificate.serial}`, '_blank');
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-gradient-to-br from-primary-50 to-purple-50">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {certificate.course.title}
          </h3>
          <p className="text-sm text-gray-600 mb-2">
            By {certificate.course.creatorName}
          </p>
          <p className="text-xs text-gray-500">
            Issued on {new Date(certificate.issuedAt).toLocaleDateString()}
          </p>
        </div>
        
        <div className="bg-primary-600 text-white p-2 rounded-full">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          className="btn-primary text-sm flex-1"
        >
          Download PDF
        </button>
        <button
          onClick={handleVerify}
          className="btn-secondary text-sm flex-1"
        >
          Verify
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-500 font-mono">
        Serial: {certificate.serial.substring(0, 16)}...
      </div>
    </div>
  );
};

export default Progress;