/**
 * Test script for YouTube transcript extraction
 * Run with: node test-youtube-transcript.js
 */

const { YoutubeTranscript } = require('youtube-transcript');

// Test YouTube video IDs
const testVideos = [
  {
    id: 'dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  },
  {
    id: 'jNQXAC9IVRw',
    title: 'Me at the zoo (First YouTube video)',
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
  }
];

// Extract video ID from URL
const extractYouTubeVideoId = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

// Fetch YouTube captions
const fetchYouTubeCaptions = async (videoUrl) => {
  try {
    const videoId = extractYouTubeVideoId(videoUrl);
    
    if (!videoId) {
      throw new Error('Invalid YouTube URL or video ID');
    }
    
    console.log(`\n📺 Fetching captions for video: ${videoId}`);
    
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      throw new Error('No captions available');
    }
    
    const fullText = transcript
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      videoId,
      segments: transcript.length,
      text: fullText,
      preview: fullText.substring(0, 200) + '...'
    };
  } catch (error) {
    return {
      videoId: extractYouTubeVideoId(videoUrl),
      error: error.message
    };
  }
};

// Run tests
const runTests = async () => {
  console.log('🧪 Testing YouTube Transcript Extraction\n');
  console.log('='.repeat(60));
  
  for (const video of testVideos) {
    console.log(`\n📹 Testing: ${video.title}`);
    console.log(`   URL: ${video.url}`);
    
    const result = await fetchYouTubeCaptions(video.url);
    
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    } else {
      console.log(`   ✅ Success!`);
      console.log(`   📊 Segments: ${result.segments}`);
      console.log(`   📝 Characters: ${result.text.length}`);
      console.log(`   📄 Preview: ${result.preview}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Test complete!\n');
};

// Run the tests
runTests().catch(console.error);
