import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  BookOpenIcon,
  PlayIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  ClockIcon,
  UserGroupIcon,
  ChartBarIcon,
  XMarkIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { convertYouTubeUrl, validateVideoUrl, formatDuration, getVideoPlatform } from '../utils/videoUtils';
import axios from 'axios';
import toast from 'react-hot-toast';

const CreatorDashboard = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);

  const fetchCourses = useCallback(async () => {
    try {
      const response = await axios.get('/api/creator/courses');
      setCourses(response.data.courses || []);
    } catch (err) {
      toast.error('Failed to load courses');
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleCourseCreated = (newCourse) => {
    setCourses([newCourse, ...courses]);
    setShowCreateCourseModal(false);
    toast.success('Course created successfully!');
  };

  const handleCourseUpdated = (updatedCourse) => {
    setCourses(courses.map(c => c.id === updatedCourse.id ? updatedCourse : c));
    setEditingCourse(null);
    toast.success('Course updated successfully!');
  };

  const handleCourseDeleted = (courseId) => {
    setCourses(courses.filter(course => course.id !== courseId));
    toast.success('Course deleted successfully!');
  };

  const handleLessonAdded = (courseId, newLesson) => {
    setCourses(courses.map(course =>
      course.id === courseId
        ? { ...course, lessonCount: (course.lessonCount || 0) + 1 }
        : course
    ));
    setShowLessonModal(false);
    setSelectedCourse(null);
    toast.success('Lesson added successfully!');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Creator Dashboard</h1>
        <Button
          onClick={() => setShowCreateCourseModal(true)}
          className="flex items-center"
          size="lg"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create New Course
        </Button>
      </div>



      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="card text-center">
          <div className="text-2xl font-bold text-primary-600 mb-1">
            {courses.length}
          </div>
          <div className="text-gray-600">Total Courses</div>
        </div>

        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {courses.filter(c => c.published).length}
          </div>
          <div className="text-gray-600">Published</div>
        </div>

        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {courses.reduce((sum, c) => sum + c.enrollmentCount, 0)}
          </div>
          <div className="text-gray-600">Total Enrollments</div>
        </div>

        <div className="card text-center">
          <div className="text-2xl font-bold text-purple-600 mb-1">
            {courses.reduce((sum, c) => sum + c.lessonCount, 0)}
          </div>
          <div className="text-gray-600">Total Lessons</div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreateCourseModal && (
          <CreateCourseModal
            onClose={() => setShowCreateCourseModal(false)}
            onCourseCreated={handleCourseCreated}
          />
        )}

        {editingCourse && (
          <EditCourseModal
            course={editingCourse}
            onClose={() => setEditingCourse(null)}
            onCourseUpdated={handleCourseUpdated}
          />
        )}

        {showLessonModal && selectedCourse && (
          <AddLessonModal
            course={selectedCourse}
            onClose={() => {
              setShowLessonModal(false);
              setSelectedCourse(null);
            }}
            onLessonAdded={handleLessonAdded}
          />
        )}
      </AnimatePresence>

      {/* Courses List */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">My Courses</h2>
          <Badge variant="outline">{courses.length} courses</Badge>
        </div>

        {courses.length === 0 ? (
          <div className="text-center py-16">
            <BookOpenIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No courses created yet</h3>
            <p className="text-gray-600 mb-6">Create your first course to start teaching and sharing your knowledge!</p>
            <Button
              onClick={() => setShowCreateCourseModal(true)}
              size="lg"
              className="flex items-center mx-auto"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Your First Course
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course, index) => (
              <CourseCard
                key={course.id}
                course={course}
                index={index}
                onEdit={setEditingCourse}
                onDelete={handleCourseDeleted}
                onAddLesson={(course) => {
                  setSelectedCourse(course);
                  setShowLessonModal(true);
                }}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};





// Enhanced Course Card Component
const CourseCard = ({ course, index, onEdit, onDelete, onAddLesson }) => {
  const [deleting, setDeleting] = useState(false);
  const [showLessonsModal, setShowLessonsModal] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this course? This will also delete all lessons.')) return;
    
    setDeleting(true);
    try {
      await axios.delete(`/api/creator/courses/${course.id}`);
      onDelete(course.id);
    } catch (error) {
      toast.error('Failed to delete course');
      console.error('Error deleting course:', error);
    } finally {
      setDeleting(false);
    }
  };

  const togglePublish = async () => {
    try {
      await axios.put(`/api/creator/courses/${course.id}/publish`, {
        published: !course.published
      });
      toast.success(`Course ${course.published ? 'unpublished' : 'published'} successfully!`);
      window.location.reload();
    } catch (error) {
      toast.error('Failed to update course status');
      console.error('Error updating course:', error);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.1 }}
      >
        <Card hover className="h-full overflow-hidden group">
          {/* Course Header with Gradient */}
          <div className="relative">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-32 flex items-center justify-center">
              <BookOpenIcon className="h-12 w-12 text-white opacity-80" />
            </div>
            <div className="absolute top-4 right-4">
              <Badge variant={course.published ? "success" : "warning"} className="shadow-lg">
                {course.published ? 'Published' : 'Draft'}
              </Badge>
            </div>
          </div>

          {/* Course Content */}
          <div className="p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
              {course.title}
            </h3>
            <p className="text-gray-600 mb-4 line-clamp-2 leading-relaxed">
              {course.description}
            </p>
            
            {/* Course Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6 p-3 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <PlayIcon className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-lg font-bold text-gray-900">{course.lessonCount || 0}</div>
                <div className="text-xs text-gray-600">Lessons</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <UserGroupIcon className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-lg font-bold text-gray-900">{course.enrollmentCount || 0}</div>
                <div className="text-xs text-gray-600">Students</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <ClockIcon className="h-4 w-4 text-purple-600" />
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {new Date(course.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-xs text-gray-600">Created</div>
              </div>
            </div>

            {/* Wrapped Action Buttons */}
            <div className="space-y-3">
              {/* Primary Actions Row */}
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onAddLesson(course)}
                  className="flex-1 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Lesson
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLessonsModal(true)}
                  className="flex-1 flex items-center justify-center border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Edit Lessons
                </Button>
              </div>

              {/* Secondary Actions Row */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(course)}
                  className="flex-1 flex items-center justify-center"
                >
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Edit Course
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePublish}
                  className="flex-1 flex items-center justify-center"
                >
                  {course.published ? (
                    <EyeSlashIcon className="h-4 w-4 mr-1" />
                  ) : (
                    <EyeIcon className="h-4 w-4 mr-1" />
                  )}
                  {course.published ? 'Unpublish' : 'Publish'}
                </Button>
              </div>

              {/* Danger Action Row */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                loading={deleting}
                className="w-full flex items-center justify-center text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                {deleting ? 'Deleting...' : 'Delete Course'}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Edit Lessons Modal */}
      <AnimatePresence>
        {showLessonsModal && (
          <EditLessonsModal
            course={course}
            onClose={() => setShowLessonsModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// Create Course Modal
const CreateCourseModal = ({ onClose, onCourseCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await axios.post('/api/creator/courses', formData, {
        headers: {
          'Idempotency-Key': `course-create-${Date.now()}-${Math.random()}`
        }
      });
      onCourseCreated(response.data);
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || 'Failed to create course';
      toast.error(errorMsg);
      console.error('Error creating course:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Create New Course</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <Input
              label="Course Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter course title"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what students will learn in this course"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows={4}
                required
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex gap-3">
              <Button type="submit" loading={creating} className="flex-1">
                {creating ? 'Creating...' : 'Create Course'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// Edit Course Modal
const EditCourseModal = ({ course, onClose, onCourseUpdated }) => {
  const [formData, setFormData] = useState({
    title: course.title,
    description: course.description
  });
  const [updating, setUpdating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUpdating(true);

    try {
      const response = await axios.put(`/api/creator/courses/${course.id}`, formData);
      onCourseUpdated(response.data);
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || 'Failed to update course';
      toast.error(errorMsg);
      console.error('Error updating course:', error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Edit Course</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <Input
              label="Course Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter course title"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what students will learn in this course"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows={4}
                required
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex gap-3">
              <Button type="submit" loading={updating} className="flex-1">
                {updating ? 'Updating...' : 'Update Course'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// Add Lesson Modal
const AddLessonModal = ({ course, onClose, onLessonAdded }) => {
  const [formData, setFormData] = useState({
    title: '',
    contentUrl: '',
    durationSec: 300,
    order: 1
  });
  const [adding, setAdding] = useState(false);
  const [urlValidation, setUrlValidation] = useState({ isValid: true, message: '' });
  const [videoPreview, setVideoPreview] = useState(null);

  // Validate URL when it changes
  useEffect(() => {
    if (formData.contentUrl) {
      const validation = validateVideoUrl(formData.contentUrl);
      setUrlValidation(validation);
      
      // Set video preview info
      if (validation.isValid) {
        const platform = getVideoPlatform(formData.contentUrl);
        setVideoPreview({
          platform,
          processedUrl: convertYouTubeUrl(formData.contentUrl)
        });
      } else {
        setVideoPreview(null);
      }
    } else {
      setUrlValidation({ isValid: true, message: '' });
      setVideoPreview(null);
    }
  }, [formData.contentUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!urlValidation.isValid) {
      toast.error('Please provide a valid video URL');
      return;
    }

    setAdding(true);

    try {
      // Process the URL (convert YouTube URLs to embeddable format)
      const processedData = {
        ...formData,
        contentUrl: convertYouTubeUrl(formData.contentUrl)
      };

      const response = await axios.post(
        `/api/creator/courses/${course.id}/lessons`,
        processedData,
        {
          headers: {
            'Idempotency-Key': `lesson-${course.id}-${formData.order}-${Date.now()}`
          }
        }
      );
      onLessonAdded(course.id, response.data);
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || 'Failed to add lesson';
      toast.error(errorMsg);
      console.error('Error adding lesson:', error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">Add Lesson to "{course.title}"</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 ">
          <Input
            label="Lesson Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter lesson title"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Video URL
            </label>
            <div className="relative">
              <Input
                value={formData.contentUrl}
                onChange={(e) => setFormData({ ...formData, contentUrl: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=VIDEO_ID or direct video URL"
                required
                className={`${!urlValidation.isValid ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              {formData.contentUrl && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {urlValidation.isValid ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                  )}
                </div>
              )}
            </div>
            
            {/* URL Validation Message */}
            {formData.contentUrl && (
              <div className={`mt-1 text-sm ${urlValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                {urlValidation.message}
              </div>
            )}
            
            {/* Video Preview Info */}
            {videoPreview && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-800">
                    {videoPreview.platform === 'youtube' ? 'YouTube Video Detected' : 
                     videoPreview.platform === 'direct' ? 'Direct Video URL' : 
                     `${videoPreview.platform} Video`}
                  </span>
                </div>
                {videoPreview.platform === 'youtube' && (
                  <div className="text-xs text-green-700">
                    Will be converted to embeddable format: {videoPreview.processedUrl}
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">📹 Supported Video Sources:</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• <strong>YouTube:</strong> https://www.youtube.com/watch?v=VIDEO_ID</li>
                <li>• <strong>YouTube Short:</strong> https://youtu.be/VIDEO_ID</li>
                <li>• <strong>Direct Video:</strong> https://example.com/video.mp4</li>
                <li>• <strong>Google Drive:</strong> Shareable direct link</li>
                <li>• <strong>Dropbox:</strong> Direct download link</li>
              </ul>
              <div className="mt-2 text-xs text-blue-700">
                <strong>Tip:</strong> YouTube URLs will be automatically converted to embeddable format for better playback.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (seconds)
              </label>
              <Input
                type="number"
                value={formData.durationSec}
                onChange={(e) => setFormData({ ...formData, durationSec: parseInt(e.target.value) })}
                min="1"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Duration: {formatDuration(formData.durationSec)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lesson Order
              </label>
              <Input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                min="1"
                required
              />
            </div>
          </div>

          </div>

          {/* Fixed Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex gap-3">
              <Button type="submit" loading={adding} className="flex-1 flex items-center justify-center">
                <VideoCameraIcon className="h-4 w-4 mr-2" />
                {adding ? 'Adding Lesson...' : 'Add Lesson'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// Edit Lessons Modal Component
const EditLessonsModal = ({ course, onClose }) => {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingLesson, setEditingLesson] = useState(null);

  const fetchLessons = useCallback(async () => {
    try {
      const response = await axios.get(`/api/creator/courses/${course.id}/lessons`);
      setLessons(response.data.lessons || []);
    } catch (error) {
      toast.error('Failed to load lessons');
      console.error('Error fetching lessons:', error);
    } finally {
      setLoading(false);
    }
  }, [course.id]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm('Are you sure you want to delete this lesson?')) return;

    try {
      await axios.delete(`/api/creator/courses/${course.id}/lessons/${lessonId}`);
      setLessons(lessons.filter(l => l.id !== lessonId));
      toast.success('Lesson deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete lesson');
      console.error('Error deleting lesson:', error);
    }
  };

  const handleEditLesson = (lesson) => {
    setEditingLesson(lesson);
  };

  const handleLessonUpdated = (updatedLesson) => {
    setLessons(lessons.map(l => l.id === updatedLesson.id ? updatedLesson : l));
    setEditingLesson(null);
    toast.success('Lesson updated successfully!');
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-lg w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">
            Edit Lessons - {course.title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-2 text-gray-600">Loading lessons...</span>
            </div>
          ) : lessons.length === 0 ? (
            <div className="text-center py-12">
              <PlayIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No lessons yet</h3>
              <p className="text-gray-600">Add your first lesson to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lessons.map((lesson, index) => (
                <Card key={lesson.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-indigo-600">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-medium text-gray-900">{lesson.title}</h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                          <div className="flex items-center">
                            <ClockIcon className="h-4 w-4 mr-1" />
                            <span>{Math.floor(lesson.durationSec / 60)}:{(lesson.durationSec % 60).toString().padStart(2, '0')}</span>
                          </div>
                          <div className="flex items-center">
                            <VideoCameraIcon className="h-4 w-4 mr-1" />
                            <span className="truncate max-w-xs">{lesson.contentUrl}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditLesson(lesson)}
                        className="flex items-center"
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteLesson(lesson.id)}
                        className="text-red-600 hover:text-red-700 flex items-center"
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex justify-end">
            <Button onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Edit Individual Lesson Modal */}
      <AnimatePresence>
        {editingLesson && (
          <EditLessonModal
            lesson={editingLesson}
            courseId={course.id}
            onClose={() => setEditingLesson(null)}
            onLessonUpdated={handleLessonUpdated}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Edit Individual Lesson Modal
const EditLessonModal = ({ lesson, courseId, onClose, onLessonUpdated }) => {
  const [formData, setFormData] = useState({
    title: lesson.title,
    contentUrl: lesson.contentUrl,
    durationSec: lesson.durationSec,
    order: lesson.order
  });
  const [updating, setUpdating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUpdating(true);

    try {
      const response = await axios.put(
        `/api/creator/courses/${courseId}/lessons/${lesson.id}`,
        formData
      );
      onLessonUpdated(response.data);
    } catch (error) {
      toast.error('Failed to update lesson');
      console.error('Error updating lesson:', error);
    } finally {
      setUpdating(false);
    }
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-lg w-full max-w-lg"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">Edit Lesson</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Lesson Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter lesson title"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Video URL
            </label>
            <Input
              value={formData.contentUrl}
              onChange={(e) => setFormData({ ...formData, contentUrl: e.target.value })}
              placeholder="https://your-video-hosting.com/video.mp4"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (seconds)
              </label>
              <Input
                type="number"
                value={formData.durationSec}
                onChange={(e) => setFormData({ ...formData, durationSec: parseInt(e.target.value) })}
                min="1"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Duration: {formatDuration(formData.durationSec)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lesson Order
              </label>
              <Input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                min="1"
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={updating} className="flex-1">
              {updating ? 'Updating...' : 'Update Lesson'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default CreatorDashboard;