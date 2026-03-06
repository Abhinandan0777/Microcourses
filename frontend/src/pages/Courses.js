import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchCourses = useCallback(async (offset = 0, append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      const params = {
        limit: 12,
        offset
      };

      if (searchTerm) {
        params.search = searchTerm;
      }

      const response = await axios.get('/api/courses', { params });
      
      if (append) {
        setCourses(prev => [...prev, ...response.data.items]);
      } else {
        setCourses(response.data.items);
      }
      
      setHasMore(response.data.next_offset !== null);
    } catch (err) {
      setError('Failed to load courses');
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const loadMore = () => {
    fetchCourses(courses.length, true);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCourses();
  };

  if (loading && courses.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Browse Courses</h1>
        
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input flex-1"
          />
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No courses found</h2>
          <p className="text-gray-600">
            {searchTerm ? 'Try adjusting your search terms.' : 'Check back later for new courses.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-8">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="btn-primary"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const CourseCard = ({ course }) => {
  return (
    <Link to={`/courses/${course.id}`} className="card hover:shadow-lg transition-shadow">
      {course.thumbnailUrl && (
        <img
          src={course.thumbnailUrl}
          alt={course.title}
          className="w-full h-48 object-cover rounded-lg mb-4"
        />
      )}
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{course.title}</h3>
      
      <p className="text-gray-600 mb-4 line-clamp-3">{course.description}</p>
      
      <div className="flex justify-between items-center text-sm text-gray-500">
        <span>By {course.creatorName}</span>
        <span>{course.lessonCount} lessons</span>
      </div>
      
      <div className="mt-4">
        <span className="btn-primary w-full text-center block">
          View Course
        </span>
      </div>
    </Link>
  );
};

export default Courses;