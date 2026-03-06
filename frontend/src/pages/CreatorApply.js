import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const CreatorApply = () => {
  const { user, refreshUser } = useAuth();
  const [application, setApplication] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    portfolioUrl: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const checkExistingApplication = useCallback(async () => {
    try {
      const response = await axios.get('/api/creators/application');
      setApplication(response.data);
      
      // If application is approved, refresh user data to update role
      if (response.data.status === 'APPROVED') {
        await refreshUser();
      }
    } catch (err) {
      // No existing application found, which is fine
      if (err.response?.status !== 404) {
        console.error('Error checking application:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    checkExistingApplication();
  }, [checkExistingApplication]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const response = await axios.post('/api/creators/apply', formData, {
        headers: {
          'Idempotency-Key': `apply-${user.id}-${Date.now()}`
        }
      });

      setApplication(response.data);
      setSuccess('Application submitted successfully!');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Creator Application</h1>

      {application ? (
        <ApplicationStatus application={application} />
      ) : (
        <ApplicationForm
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
          success={success}
        />
      )}
    </div>
  );
};

const ApplicationStatus = ({ application }) => {
  const { refreshUser } = useAuth();

  const handleGoToDashboard = async () => {
    // Refresh user data to get updated role
    await refreshUser();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusMessage = (status) => {
    switch (status) {
      case 'PENDING':
        return 'Your application is under review. We will notify you once it has been processed.';
      case 'APPROVED':
        return 'Congratulations! Your application has been approved. You can now create courses.';
      case 'REJECTED':
        return 'Your application was not approved at this time. Please contact support for more information.';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className="card">
      <div className="text-center mb-6">
        <div className={`inline-flex px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(application.status)}`}>
          {application.status}
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <p className="text-gray-900">{application.name}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <p className="text-gray-900">{application.bio}</p>
        </div>

        {application.portfolioUrl && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio URL</label>
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Submitted</label>
          <p className="text-gray-900">
            {new Date(application.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-gray-700">{getStatusMessage(application.status)}</p>
      </div>

      {application.status === 'APPROVED' && (
        <div className="mt-6 text-center">
          <Link 
            to="/creator/dashboard" 
            className="btn-primary"
            onClick={handleGoToDashboard}
          >
            Go to Creator Dashboard
          </Link>
        </div>
      )}
    </div>
  );
};

const ApplicationForm = ({ formData, onChange, onSubmit, submitting, error, success }) => {
  return (
    <div className="card">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Apply to Become a Creator</h2>
        <p className="text-gray-600">
          Share your expertise by creating courses on MicroCourses. Fill out the application below to get started.
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={onChange}
            className="input"
            required
          />
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
            Bio *
          </label>
          <textarea
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={onChange}
            rows={4}
            className="input"
            placeholder="Tell us about your background, expertise, and why you want to create courses..."
            required
            minLength={10}
          />
          <p className="text-sm text-gray-500 mt-1">
            Minimum 10 characters. Describe your experience and teaching background.
          </p>
        </div>

        <div>
          <label htmlFor="portfolioUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Portfolio URL
          </label>
          <input
            type="url"
            id="portfolioUrl"
            name="portfolioUrl"
            value={formData.portfolioUrl}
            onChange={onChange}
            className="input"
            placeholder="https://your-portfolio.com"
          />
          <p className="text-sm text-gray-500 mt-1">
            Optional. Link to your portfolio, website, or professional profile.
          </p>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Your application will be reviewed by our team</li>
            <li>• We typically respond within 2-3 business days</li>
            <li>• Once approved, you can start creating courses immediately</li>
            <li>• You'll have access to our creator dashboard and tools</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full"
        >
          {submitting ? 'Submitting Application...' : 'Submit Application'}
        </button>
      </form>
    </div>
  );
};

export default CreatorApply;