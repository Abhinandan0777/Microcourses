/**
 * Video utility functions for handling different video URL formats
 */

/**
 * Convert YouTube URL to embeddable format
 * @param {string} url - YouTube URL (watch, share, or embed format)
 * @returns {string} - Embeddable YouTube URL
 */
export const convertYouTubeUrl = (url) => {
  if (!url) return '';

  // Already an embed URL
  if (url.includes('youtube.com/embed/')) {
    return url;
  }

  // Extract video ID from various YouTube URL formats
  let videoId = '';

  // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
  if (url.includes('youtube.com/watch?v=')) {
    videoId = url.split('v=')[1]?.split('&')[0];
  }
  // Short URL: https://youtu.be/VIDEO_ID
  else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0];
  }
  // Mobile URL: https://m.youtube.com/watch?v=VIDEO_ID
  else if (url.includes('m.youtube.com/watch?v=')) {
    videoId = url.split('v=')[1]?.split('&')[0];
  }

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Return original URL if not a YouTube URL
  return url;
};

/**
 * Get YouTube video thumbnail
 * @param {string} url - YouTube URL
 * @returns {string} - Thumbnail URL
 */
export const getYouTubeThumbnail = (url) => {
  const videoId = extractYouTubeVideoId(url);
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }
  return '';
};

/**
 * Extract YouTube video ID from URL
 * @param {string} url - YouTube URL
 * @returns {string} - Video ID
 */
export const extractYouTubeVideoId = (url) => {
  if (!url) return '';

  let videoId = '';

  if (url.includes('youtube.com/watch?v=')) {
    videoId = url.split('v=')[1]?.split('&')[0];
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0];
  } else if (url.includes('youtube.com/embed/')) {
    videoId = url.split('embed/')[1]?.split('?')[0];
  } else if (url.includes('m.youtube.com/watch?v=')) {
    videoId = url.split('v=')[1]?.split('&')[0];
  }

  return videoId;
};

/**
 * Check if URL is a YouTube URL
 * @param {string} url - URL to check
 * @returns {boolean} - True if YouTube URL
 */
export const isYouTubeUrl = (url) => {
  if (!url) return false;

  return url.includes('youtube.com') || url.includes('youtu.be');
};

/**
 * Validate video URL format
 * @param {string} url - Video URL
 * @returns {object} - Validation result with isValid and message
 */
export const validateVideoUrl = (url) => {
  if (!url) {
    return { isValid: false, message: 'Video URL is required' };
  }

  // Check if it's a YouTube URL
  if (isYouTubeUrl(url)) {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return { isValid: false, message: 'Invalid YouTube URL format' };
    }
    return { isValid: true, message: 'Valid YouTube URL' };
  }

  // Check if it's a direct video file URL
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
  const hasVideoExtension = videoExtensions.some(ext =>
    url.toLowerCase().includes(ext)
  );

  if (hasVideoExtension) {
    return { isValid: true, message: 'Valid video file URL' };
  }

  // Check if it's a valid URL format
  try {
    new URL(url);
    return { isValid: true, message: 'Valid URL format' };
  } catch {
    return { isValid: false, message: 'Invalid URL format' };
  }
};

/**
 * Format duration from seconds to readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration (e.g., "5:30", "1:23:45")
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Parse duration from string format to seconds
 * @param {string} duration - Duration string (e.g., "5:30", "1:23:45")
 * @returns {number} - Duration in seconds
 */
export const parseDuration = (duration) => {
  if (!duration) return 0;

  const parts = duration.split(':').map(Number);

  if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
};

/**
 * Get video hosting platform from URL
 * @param {string} url - Video URL
 * @returns {string} - Platform name
 */
export const getVideoPlatform = (url) => {
  if (!url) return 'unknown';

  if (isYouTubeUrl(url)) return 'youtube';
  if (url.includes('vimeo.com')) return 'vimeo';
  if (url.includes('drive.google.com')) return 'google-drive';
  if (url.includes('dropbox.com')) return 'dropbox';
  if (url.includes('localhost') || url.includes('127.0.0.1')) return 'local';

  return 'direct';
};