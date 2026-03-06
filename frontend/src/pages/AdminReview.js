import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AdminReview = () => {
  const [activeTab, setActiveTab] = useState('applications');
  const [applications, setApplications] = useState([]);
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'applications') {
        const response = await axios.get('/api/admin/creators?status=PENDING');
        setApplications(response.data.items);
      } else if (activeTab === 'courses') {
        const response = await axios.get('/api/admin/courses');
        setCourses(response.data.items);
      } else if (activeTab === 'stats') {
        const response = await axios.get('/api/admin/stats');
        setStats(response.data);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApplicationAction = async (applicationId, action) => {
    try {
      await axios.put(`/api/admin/creators/${applicationId}/${action}`);
      // Refresh applications
      fetchData();
    } catch (err) {
      alert(`Failed to ${action} application`);
      console.error(`Error ${action}ing application:`, err);
    }
  };

  const handleCoursePublish = async (courseId, published) => {
    try {
      await axios.put(`/api/admin/courses/${courseId}/publish`, { published });
      // Refresh courses
      fetchData();
    } catch (err) {
      alert('Failed to update course status');
      console.error('Error updating course:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'applications', label: 'Creator Applications' },
            { id: 'courses', label: 'Course Management' },
            { id: 'stats', label: 'Platform Statistics' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {activeTab === 'applications' && (
            <ApplicationsTab
              applications={applications}
              onAction={handleApplicationAction}
            />
          )}
          
          {activeTab === 'courses' && (
            <CoursesTab
              courses={courses}
              onPublishToggle={handleCoursePublish}
            />
          )}
          
          {activeTab === 'stats' && stats && (
            <StatsTab stats={stats} />
          )}
        </>
      )}
    </div>
  );
};

const ApplicationsTab = ({ applications, onAction }) => {
  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Pending Creator Applications</h2>
      
      {applications.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pending applications</h3>
          <p className="text-gray-600">All creator applications have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {applications.map((application) => (
            <ApplicationCard
              key={application.applicationId}
              application={application}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ApplicationCard = ({ application, onAction }) => {
  const [processing, setProcessing] = useState(null);

  const handleAction = async (action) => {
    setProcessing(action);
    await onAction(application.applicationId, action);
    setProcessing(null);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {application.name}
          </h3>
          <p className="text-gray-600 mb-2">
            Email: {application.user.email}
          </p>
          <p className="text-gray-600 mb-4">
            Applied: {new Date(application.createdAt).toLocaleDateString()}
          </p>
        </div>
        
        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
          {application.status}
        </span>
      </div>

      <div className="mb-4">
        <h4 className="font-medium text-gray-900 mb-2">Bio:</h4>
        <p className="text-gray-700">{application.bio}</p>
      </div>

      {application.portfolioUrl && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-900 mb-2">Portfolio:</h4>
          <a
            href={application.portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700"
          >
            {application.portfolioUrl}
          </a>
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => handleAction('approve')}
          disabled={processing}
          className="btn-primary"
        >
          {processing === 'approve' ? 'Approving...' : 'Approve'}
        </button>
        <button
          onClick={() => handleAction('reject')}
          disabled={processing}
          className="btn-danger"
        >
          {processing === 'reject' ? 'Rejecting...' : 'Reject'}
        </button>
      </div>
    </div>
  );
};

const CoursesTab = ({ courses, onPublishToggle }) => {
  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Course Management</h2>
      
      {courses.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
          <p className="text-gray-600">No courses have been created yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onPublishToggle={onPublishToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CourseCard = ({ course, onPublishToggle }) => {
  const [updating, setUpdating] = useState(false);

  const handleTogglePublish = async () => {
    setUpdating(true);
    await onPublishToggle(course.id, !course.published);
    setUpdating(false);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{course.title}</h3>
          <p className="text-gray-600 mb-2">{course.description}</p>
          
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
            <span>By {course.creator.name}</span>
            <span>{course.lessonCount} lessons</span>
            <span>{course.enrollmentCount} enrollments</span>
          </div>
          
          <p className="text-sm text-gray-500">
            Created: {new Date(course.createdAt).toLocaleDateString()}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            course.published 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {course.published ? 'Published' : 'Draft'}
          </span>
          
          <button
            onClick={handleTogglePublish}
            disabled={updating}
            className={course.published ? 'btn-secondary' : 'btn-primary'}
          >
            {updating 
              ? 'Updating...' 
              : course.published 
                ? 'Unpublish' 
                : 'Publish'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

const StatsTab = ({ stats }) => {
  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card text-center">
          <div className="text-3xl font-bold text-primary-600 mb-2">
            {stats.users.total}
          </div>
          <div className="text-gray-600">Total Users</div>
          <div className="text-sm text-gray-500 mt-2">
            {stats.users.learner || 0} learners, {stats.users.creator || 0} creators
          </div>
        </div>
        
        <div className="card text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {stats.courses.total}
          </div>
          <div className="text-gray-600">Total Courses</div>
          <div className="text-sm text-gray-500 mt-2">
            {stats.courses.published || 0} published
          </div>
        </div>
        
        <div className="card text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {stats.enrollments.total}
          </div>
          <div className="text-gray-600">Total Enrollments</div>
        </div>
        
        <div className="card text-center">
          <div className="text-3xl font-bold text-purple-600 mb-2">
            {stats.certificates.total}
          </div>
          <div className="text-gray-600">Certificates Issued</div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Breakdown</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Learners:</span>
              <span className="font-medium">{stats.users.learner || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Creators:</span>
              <span className="font-medium">{stats.users.creator || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Admins:</span>
              <span className="font-medium">{stats.users.admin || 0}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Creator Applications</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Pending:</span>
              <span className="font-medium">{stats.applications.pending || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Approved:</span>
              <span className="font-medium">{stats.applications.approved || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Rejected:</span>
              <span className="font-medium">{stats.applications.rejected || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReview;