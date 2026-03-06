import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { 
  PlayIcon,
  ClockIcon,
  BookOpenIcon,
  CheckCircleIcon,
  LockClosedIcon,
  UserIcon,
  CalendarIcon,
  ChartBarIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import axios from 'axios';
import toast from 'react-hot-toast';

const CourseDetail = () => {
  const { id } = useParams();
  const { isLearner, user } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [progress, setProgress] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const fetchCourse = useCallback(async () => {
    try {
      const response = await axios.get(`/api/courses/${id}`);
      
      // FIX ISSUE 1: Only show error if response is invalid
      if (!response.data) {
        toast.error('Failed to load course details');
        return;
      }
      
      setCourse(response.data);
      
      // Fetch progress if enrolled
      if (response.data.isEnrolled && isLearner) {
        try {
          const progressResponse = await axios.get(`/api/courses/${id}/progress`);
          if (progressResponse.data) {
            setProgress(progressResponse.data);
          }
        } catch (progressErr) {
          // Progress fetch failed, but don't show error - course still loads
          console.warn('Could not fetch progress:', progressErr);
        }
      }
    } catch (err) {
      // Only show error toast when API actually fails
      toast.error('Failed to load course details');
      console.error('Error fetching course:', err);
    } finally {
      setLoading(false);
    }
  }, [id, isLearner]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const handleEnroll = async () => {
    if (!isLearner) {
      toast.error('Please login as a learner to enroll');
      return;
    }

    setEnrolling(true);
    try {
      await axios.post(`/api/courses/${id}/enroll`, {}, {
        headers: {
          'Idempotency-Key': `enroll-${id}-${Date.now()}`
        }
      });
      
      toast.success('Successfully enrolled in course!');
      await fetchCourse();
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to enroll in course';
      toast.error(errorMsg);
      console.error('Error enrolling:', err);
    } finally {
      setEnrolling(false);
    }
  };

  const calculateTotalDuration = () => {
    if (!course?.lessons) return 0;
    return course.lessons.reduce((total, lesson) => total + lesson.durationSec, 0);
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!course) {
    return (
      <motion.div 
        className="text-center py-16"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <BookOpenIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Course Not Found</h2>
        <p className="text-gray-600 mb-6">The course you are looking for does not exist.</p>
        <Link to="/courses">
          <Button>Browse Courses</Button>
        </Link>
      </motion.div>
    );
  }

  const totalDuration = calculateTotalDuration();
  const completedLessons = progress?.completedLessons || 0;
  const progressPercentage = course.lessons.length > 0 ? Math.round((completedLessons / course.lessons.length) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Course Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="mb-8">
              {/* Course Image/Video Preview */}
              <div className="relative mb-6">
                {course.thumbnailUrl ? (
                  <div className="relative">
                    <img
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="w-full h-64 object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-40 rounded-lg flex items-center justify-center">
                      <Button
                        onClick={() => setShowPreview(true)}
                        className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white border-white"
                        size="lg"
                      >
                        <PlayIcon className="h-6 w-6 mr-2" />
                        Preview Course
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center">
                    <BookOpenIcon className="h-20 w-20 text-indigo-400" />
                  </div>
                )}
              </div>

              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <UserIcon className="h-4 w-4 mr-1" />
                      <span>{course.creatorName}</span>
                    </div>
                    <div className="flex items-center">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      <span>{new Date(course.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                {course.published && (
                  <Badge variant="success">Published</Badge>
                )}
              </div>

              <p className="text-gray-700 mb-6 leading-relaxed">{course.description}</p>

              {/* Course Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{course.lessons.length}</div>
                  <div className="text-sm text-gray-600">Lessons</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{formatDuration(totalDuration)}</div>
                  <div className="text-sm text-gray-600">Duration</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{course.enrollmentCount || 0}</div>
                  <div className="text-sm text-gray-600">Students</div>
                </div>
              </div>

              {/* Enrollment Status & Actions */}
              {isLearner && (
                <div className="border-t pt-6">
                  {course.isEnrolled ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                          <span className="font-medium text-green-800">Enrolled</span>
                        </div>
                        <Badge variant="info">{progressPercentage}% Complete</Badge>
                      </div>
                      
                      {progress && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      )}
                      
                      <div className="flex gap-3">
                        <Link to="/progress">
                          <Button variant="outline" className="flex items-center">
                            <ChartBarIcon className="h-4 w-4 mr-2" />
                            View Progress
                          </Button>
                        </Link>
                        {course.lessons.length > 0 && (
                          <Link to={`/learn/${course.lessons[0].id}`}>
                            <Button className="flex items-center">
                              <PlayIcon className="h-4 w-4 mr-2" />
                              {completedLessons > 0 ? 'Continue Learning' : 'Start Learning'}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={handleEnroll}
                      loading={enrolling}
                      size="lg"
                      className="w-full"
                    >
                      {enrolling ? 'Enrolling...' : 'Enroll in Course'}
                    </Button>
                  )}
                </div>
              )}

              {!isLearner && (
                <div className="border-t pt-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800">
                      Please <Link to="/login" className="font-medium underline">login as a learner</Link> to enroll in this course.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Course Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Course Content</h2>
                <Badge variant="outline">{course.lessons.length} lessons</Badge>
              </div>
              
              {course.lessons.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpenIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No lessons available yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {course.lessons.map((lesson, index) => (
                    <LessonItem
                      key={lesson.id}
                      lesson={lesson}
                      index={index}
                      isEnrolled={course.isEnrolled}
                      isLearner={isLearner}
                      isCompleted={progress?.completedLessonIds?.includes(lesson.id)}
                    />
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="sticky top-6"
          >
            {/* Instructor Info */}
            <Card className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Instructor</h3>
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                  <UserIcon className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{course.creatorName}</div>
                  <div className="text-sm text-gray-600">Course Creator</div>
                </div>
              </div>
            </Card>

            {/* Course Features */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">What You'll Get</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <PlayIcon className="h-5 w-5 text-green-600 mr-3" />
                  <span className="text-gray-700">{course.lessons.length} video lessons</span>
                </div>
                <div className="flex items-center">
                  <ClockIcon className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="text-gray-700">{formatDuration(totalDuration)} of content</span>
                </div>
                <div className="flex items-center">
                  <BookOpenIcon className="h-5 w-5 text-purple-600 mr-3" />
                  <span className="text-gray-700">Lesson transcripts</span>
                </div>
                <div className="flex items-center">
                  <AcademicCapIcon className="h-5 w-5 text-yellow-600 mr-3" />
                  <span className="text-gray-700">Certificate of completion</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const LessonItem = ({ lesson, index, isEnrolled, isLearner, isCompleted }) => {
  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const canAccess = isEnrolled && isLearner;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`flex items-center justify-between p-4 border rounded-lg transition-all hover:shadow-md ${
        isCompleted 
          ? 'border-green-200 bg-green-50' 
          : canAccess 
            ? 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100' 
            : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
          isCompleted
            ? 'bg-green-100 text-green-700'
            : canAccess
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-gray-100 text-gray-500'
        }`}>
          {isCompleted ? (
            <CheckCircleIcon className="h-5 w-5" />
          ) : (
            <span>{index + 1}</span>
          )}
        </div>
        
        <div className="flex-1">
          <h3 className={`font-medium ${
            isCompleted ? 'text-green-900' : canAccess ? 'text-indigo-900' : 'text-gray-700'
          }`}>
            {lesson.title}
          </h3>
          <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
            <div className="flex items-center">
              <ClockIcon className="h-4 w-4 mr-1" />
              <span>{formatDuration(lesson.durationSec)}</span>
            </div>
            {lesson.hasTranscript && (
              <Badge variant="outline" size="sm">Transcript</Badge>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isCompleted && (
          <Badge variant="success" size="sm">Completed</Badge>
        )}
        
        {canAccess ? (
          <Link to={`/learn/${lesson.id}`}>
            <Button 
              size="sm" 
              variant={isCompleted ? "outline" : "default"}
              className="flex items-center"
            >
              <PlayIcon className="h-4 w-4 mr-1" />
              {isCompleted ? 'Review' : 'Start'}
            </Button>
          </Link>
        ) : (
          <div className="flex items-center text-gray-400">
            <LockClosedIcon className="h-4 w-4 mr-1" />
            <span className="text-sm">
              {isLearner ? 'Enroll to access' : 'Login required'}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CourseDetail;