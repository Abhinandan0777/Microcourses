import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  DocumentTextIcon,
  EyeIcon,
  EyeSlashIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  ChartBarIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { isYouTubeUrl, getVideoPlatform, extractYouTubeVideoId } from '../utils/videoUtils';
import axios from 'axios';
import toast from 'react-hot-toast';

const LessonPlayer = () => {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const youtubePlayerRef = useRef(null); // FIX ISSUE 2: YouTube player reference
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [generatingTranscript, setGeneratingTranscript] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [watchTime, setWatchTime] = useState(0);
  const [isProcessingPlayPause, setIsProcessingPlayPause] = useState(false);
  const [youtubeReady, setYoutubeReady] = useState(false); // FIX ISSUE 2: YouTube API ready state
  const [autoCompleted, setAutoCompleted] = useState(false); // FIX ISSUE 2: Prevent duplicate auto-completion

  const fetchLesson = useCallback(async () => {
    try {
      const response = await axios.get(`/api/lessons/${lessonId}`);
      setLesson(response.data);
      
      // Set video duration from lesson data
      if (response.data.durationSec) {
        setVideoDuration(response.data.durationSec);
      }
      
      // Fetch transcript if available
      if (response.data.hasTranscript || response.data.transcript) {
        if (response.data.transcript) {
          setTranscript(response.data.transcript);
        } else {
          fetchTranscript();
        }
      }
    } catch (err) {
      toast.error('Failed to load lesson');
      console.error('Error fetching lesson:', err);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  const fetchTranscript = useCallback(async () => {
    setTranscriptLoading(true);
    try {
      const response = await axios.get(`/api/lessons/${lessonId}/transcript`);
      setTranscript(response.data);
    } catch (err) {
      console.error('Error fetching transcript:', err);
    } finally {
      setTranscriptLoading(false);
    }
  }, [lessonId]);

  const generateTranscript = async () => {
    if (!lesson?.contentUrl) {
      toast.error('No video content available for transcript generation');
      return;
    }

    setGeneratingTranscript(true);
    try {
      // Call transcript generation API
      const response = await axios.post(`/api/lessons/${lessonId}/generate`, {
        videoUrl: lesson.contentUrl
      });
      
      setTranscript(response.data);
      setLesson(prev => ({ ...prev, hasTranscript: true }));
      toast.success('Transcript generated successfully!');
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to generate transcript';
      toast.error(errorMsg);
      console.error('Error generating transcript:', err);
    } finally {
      setGeneratingTranscript(false);
    }
  };

  useEffect(() => {
    fetchLesson();
  }, [fetchLesson]);

  // FIX ISSUE 2: Load YouTube iframe API
  useEffect(() => {
    if (!lesson?.contentUrl || !isYouTubeUrl(lesson.contentUrl)) return;

    // Load YouTube iframe API if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      // API ready callback
      window.onYouTubeIframeAPIReady = () => {
        setYoutubeReady(true);
      };
    } else {
      setYoutubeReady(true);
    }
  }, [lesson]);

  // FIX ISSUE 2: Initialize YouTube player when ready
  useEffect(() => {
    if (!youtubeReady || !lesson?.contentUrl || !isYouTubeUrl(lesson.contentUrl)) return;

    const videoId = extractYouTubeVideoId(lesson.contentUrl);
    if (!videoId) return;

    // Initialize YouTube player
    youtubePlayerRef.current = new window.YT.Player('youtube-player', {
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: (event) => {
          const duration = event.target.getDuration();
          setVideoDuration(duration);
        },
        onStateChange: (event) => {
          // Track playing state
          if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
          } else if (event.data === window.YT.PlayerState.ENDED) {
            // FIX ISSUE 2: Auto-complete when video ends
            setIsPlaying(false);
            handleVideoEnded();
          }
        }
      }
    });

    // Track YouTube video progress
    const progressInterval = setInterval(() => {
      if (youtubePlayerRef.current && youtubePlayerRef.current.getCurrentTime) {
        const currentTime = youtubePlayerRef.current.getCurrentTime();
        setVideoProgress(currentTime);
      }
    }, 1000);

    return () => {
      clearInterval(progressInterval);
      if (youtubePlayerRef.current && youtubePlayerRef.current.destroy) {
        youtubePlayerRef.current.destroy();
      }
    };
  }, [youtubeReady, lesson]);

  // FIX ISSUE 2: Handle video completion automatically
  const handleVideoEnded = async () => {
    if (autoCompleted || lesson?.isCompleted) return;
    
    const watchPercentage = videoDuration > 0 ? (videoProgress / videoDuration) * 100 : 100;
    
    // Auto-complete if watched at least 80%
    if (watchPercentage >= 80) {
      setAutoCompleted(true);
      await handleComplete(true);
    }
  };

  // Track watch time
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && videoRef.current) {
        setWatchTime(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Cleanup video on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.load();
      }
    };
  }, []);

  const handleComplete = async (isAutoComplete = false) => {
    const requiredWatchPercentage = 80; // 80% of video must be watched
    const watchPercentage = videoDuration > 0 ? (videoProgress / videoDuration) * 100 : 0;
    
    if (!isAutoComplete && watchPercentage < requiredWatchPercentage) {
      toast.error(`Please watch at least ${requiredWatchPercentage}% of the lesson to mark it complete`);
      return;
    }

    setCompleting(true);
    try {
      await axios.post(`/api/lessons/${lessonId}/complete`, {
        watchTime,
        watchPercentage: Math.round(watchPercentage)
      });
      
      // FIX ISSUE 2: Refresh lesson data to update completion status
      await fetchLesson();
      
      toast.success(isAutoComplete ? 'Lesson completed automatically!' : 'Lesson marked as complete!');
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || 'Failed to mark lesson as complete';
      
      // Don't show error if already completed
      if (err.response?.data?.error?.code !== 'ALREADY_COMPLETED') {
        toast.error(errorMsg);
      }
      console.error('Error completing lesson:', err);
    } finally {
      setCompleting(false);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setVideoProgress(videoRef.current.currentTime);
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  const handlePlayPause = async () => {
    if (!videoRef.current || isProcessingPlayPause) return;
    
    setIsProcessingPlayPause(true);
    
    try {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        // Handle the play promise to avoid interruption errors
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        setIsPlaying(true);
      }
    } catch (error) {
      // Handle play interruption gracefully
      if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
        console.warn('Video play/pause error:', error);
      }
      // Reset the playing state based on actual video state
      setIsPlaying(!videoRef.current.paused);
    } finally {
      // Add a small delay to prevent rapid successive calls
      setTimeout(() => {
        setIsProcessingPlayPause(false);
      }, 100);
    }
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  };

  const handlePlaybackRateChange = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleSeek = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setVideoProgress(time);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <motion.div 
        className="text-center py-16"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <PlayIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Lesson Not Found</h2>
        <p className="text-gray-600 mb-6">The lesson you are looking for does not exist.</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </motion.div>
    );
  }

  const progressPercentage = videoDuration > 0 ? (videoProgress / videoDuration) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-4 gap-8">
        {/* Main Video Content */}
        <div className="lg:col-span-3">
          {/* Lesson Header */}
          <motion.div 
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              variant="ghost"
              onClick={() => navigate(`/courses/${lesson.courseId}`)}
              className="mb-4 p-0 h-auto font-normal text-indigo-600 hover:text-indigo-700"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to {lesson.courseTitle}
            </Button>
            
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{lesson.title}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <span className="font-medium">Lesson {lesson.order}</span>
                  </div>
                  <div className="flex items-center">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    <span>{formatDuration(lesson.durationSec)}</span>
                  </div>
                  {lesson.isCompleted && (
                    <Badge variant="success" className="flex items-center">
                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                      Completed
                    </Badge>
                  )}
                </div>
              </div>
              
              {!lesson.isCompleted && (
                <Button
                  onClick={handleComplete}
                  loading={completing}
                  className="flex items-center"
                >
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  {completing ? 'Marking Complete...' : 'Mark Complete'}
                </Button>
              )}
            </div>
          </motion.div>

          {/* Video Player */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="mb-6 p-0 overflow-hidden">
              <div className="aspect-video bg-gray-900 relative">
                {lesson.contentUrl ? (
                  isYouTubeUrl(lesson.contentUrl) ? (
                    // FIX ISSUE 2: YouTube Embed with iframe API support
                    <div id="youtube-player" className="w-full h-full"></div>
                  ) : (
                    // Direct Video
                    <video
                      ref={videoRef}
                      className="w-full h-full"
                      controls
                      onTimeUpdate={handleVideoTimeUpdate}
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      onError={(e) => console.warn('Video error:', e)}
                      poster="/api/placeholder/800/450"
                    >
                      <source src={lesson.contentUrl} type="video/mp4" />
                      <source src={lesson.contentUrl} type="video/webm" />
                      <source src={lesson.contentUrl} type="video/ogg" />
                      Your browser does not support the video tag.
                    </video>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-white">
                    <div className="text-center">
                      <PlayIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg mb-2">Video content will be available here</p>
                      <p className="text-sm opacity-75">Content URL: {lesson.contentUrl}</p>
                    </div>
                  </div>
                )}
                
                {/* Custom Video Controls - Only for direct videos, not YouTube */}
                {lesson.contentUrl && !isYouTubeUrl(lesson.contentUrl) && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                    <div className="flex items-center gap-4 text-white">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePlayPause}
                        className="text-white hover:bg-white hover:bg-opacity-20"
                      >
                        {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                      </Button>
                      
                      <div className="flex-1">
                        <div className="w-full bg-white bg-opacity-30 rounded-full h-1">
                          <div 
                            className="bg-indigo-500 h-1 rounded-full transition-all"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      </div>
                      
                      <span className="text-sm">
                        {formatDuration(videoProgress)} / {formatDuration(videoDuration)}
                      </span>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMuteToggle}
                        className="text-white hover:bg-white hover:bg-opacity-20"
                      >
                        {isMuted ? <SpeakerXMarkIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
                      </Button>
                      
                      <select
                        value={playbackRate}
                        onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                        className="bg-transparent text-white text-sm border border-white border-opacity-30 rounded px-2 py-1"
                      >
                        <option value={0.5} className="text-black">0.5x</option>
                        <option value={0.75} className="text-black">0.75x</option>
                        <option value={1} className="text-black">1x</option>
                        <option value={1.25} className="text-black">1.25x</option>
                        <option value={1.5} className="text-black">1.5x</option>
                        <option value={2} className="text-black">2x</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {/* YouTube Video Info */}
                {lesson.contentUrl && isYouTubeUrl(lesson.contentUrl) && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="info" className="bg-red-600 text-white">
                      YouTube Video
                    </Badge>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Transcript Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <DocumentTextIcon className="h-6 w-6 mr-2" />
                  Transcript
                </h2>
                
                <div className="flex items-center gap-2">
                  {!lesson.hasTranscript && (
                    <Button
                      onClick={generateTranscript}
                      loading={generatingTranscript}
                      variant="outline"
                      size="sm"
                    >
                      {generatingTranscript ? 'Generating...' : 'Generate Transcript'}
                    </Button>
                  )}
                  
                  {lesson.hasTranscript && (
                    <Button
                      onClick={() => setShowTranscript(!showTranscript)}
                      variant="outline"
                      size="sm"
                      className="flex items-center"
                    >
                      {showTranscript ? <EyeSlashIcon className="h-4 w-4 mr-1" /> : <EyeIcon className="h-4 w-4 mr-1" />}
                      {showTranscript ? 'Hide' : 'Show'}
                    </Button>
                  )}
                </div>
              </div>
              
              <AnimatePresence>
                {showTranscript && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {transcriptLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <LoadingSpinner />
                        <span className="ml-2 text-gray-600">Loading transcript...</span>
                      </div>
                    ) : transcript ? (
                      <div className="bg-gray-50 p-6 rounded-lg">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {transcript.text}
                        </p>
                        <div className="mt-4 text-xs text-gray-500">
                          Generated on {new Date(transcript.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <DocumentTextIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No transcript available for this lesson.</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              
              {!lesson.hasTranscript && !generatingTranscript && (
                <div className="text-center py-8 text-gray-500">
                  <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-4">No transcript available for this lesson.</p>
                  <p className="text-sm">Click "Generate Transcript" to create one using AI.</p>
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
            transition={{ delay: 0.3 }}
            className="sticky top-6 space-y-6"
          >
            {/* Progress Stats */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Progress</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Video Progress</span>
                    <span>{Math.round(progressPercentage)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-indigo-600">{Math.floor(watchTime / 60)}</div>
                    <div className="text-xs text-gray-600">Minutes Watched</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {lesson.isCompleted ? '100' : Math.round(progressPercentage)}
                    </div>
                    <div className="text-xs text-gray-600">% Complete</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
              <div className="space-y-3">
                <Button
                  onClick={() => navigate(`/courses/${lesson.courseId}`)}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to Course
                </Button>
                
                {lesson.isCompleted && (
                  <Button
                    onClick={() => navigate('/progress')}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <ChartBarIcon className="h-4 w-4 mr-2" />
                    View Progress
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LessonPlayer;