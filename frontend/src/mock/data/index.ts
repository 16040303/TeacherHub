// Legacy mock dataset kept for reference and prototype demos.

export const MOCK_TEACHER = {
  id: 't1',
  name: 'Sarah Jenkins',
  avatar: 'https://picsum.photos/seed/sarah/200',
  subject: 'Science (6-8)',
  experience: '8 Years',
  location: 'Seattle, WA',
  bio: 'Passionate about STEM education, hands-on learning, and making complex concepts accessible to all students.',
  skills: ['Biology', 'Earth Science', 'STEM', 'Project-Based Learning', 'Curriculum Design', 'EdTech Integration'],
  stats: {
    sharedLessons: 150,
    totalDownloads: '12.4k',
    averageRating: 4.9
  }
};

export const FEATURED_LESSONS = [
  {
    id: 'l1',
    title: 'Interactive Math Games',
    description: 'Engaging math games for 4th graders covering multiplication and division.',
    subject: 'Math',
    gradeLevel: 'Grade 4',
    format: 'PDF',
    downloads: 120,
    rating: 4.8,
    reviewCount: 45,
    author: { name: 'Sarah Jenkins', avatar: 'https://picsum.photos/seed/sarah/100' },
    thumbnail: 'https://picsum.photos/seed/math/400/300',
    updatedAt: '2 weeks ago'
  },
  {
    id: 'l2',
    title: 'Creative Writing Prompts',
    description: 'A collection of 50 creative writing prompts for middle school students.',
    subject: 'English',
    gradeLevel: 'Middle School',
    format: 'Word',
    downloads: 85,
    rating: 4.9,
    reviewCount: 32,
    author: { name: 'Mark Davis', avatar: 'https://picsum.photos/seed/mark/100' },
    thumbnail: 'https://picsum.photos/seed/writing/400/300',
    updatedAt: '1 month ago'
  },
  {
    id: 'l3',
    title: 'Lab Experiments Guide',
    description: 'Step-by-step guide for 10 safe and exciting chemistry experiments for high school.',
    subject: 'Science',
    gradeLevel: 'High School',
    format: 'PDF',
    downloads: 200,
    rating: 4.7,
    reviewCount: 56,
    author: { name: 'Dr. Elena', avatar: 'https://picsum.photos/seed/elena/100' },
    thumbnail: 'https://picsum.photos/seed/science/400/300',
    updatedAt: '3 weeks ago'
  },
  {
    id: 'l4',
    title: 'Historical Roleplay Scenarios',
    description: 'Immersive roleplay scenarios for elementary students to learn about ancient civilizations.',
    subject: 'History',
    gradeLevel: 'Elementary',
    format: 'PPT',
    downloads: 50,
    rating: 4.6,
    reviewCount: 12,
    author: { name: 'John Smith', avatar: 'https://picsum.photos/seed/john/100' },
    thumbnail: 'https://picsum.photos/seed/history/400/300',
    updatedAt: '2 months ago'
  }
];

export const MOCK_POSTS = [
  {
    id: 'p1',
    title: 'Innovative Classroom Activities for Middle School Science',
    excerpt: "Engage your students with these creative and interactive activities...",
    content: "Engage your students with these creative and interactive activities. Last week, I tried a new approach to teaching the water cycle that completely transformed my 7th graders' engagement levels...",
    author: 'Jane Doe',
    authorAvatar: 'https://picsum.photos/seed/jane/100',
    time: '2 hours ago',
    image: 'https://picsum.photos/seed/classroom/800/450',
    date: 'Oct 24',
    readTime: '5 min read',
    tags: ['Science', 'Middle School', 'Activities'],
    likes: 42,
    comments: 12,
    category: 'Classroom Activities'
  },
  {
    id: 'p2',
    title: 'Effective Management Tips: The Quiet Signal',
    excerpt: "Struggling to get your class's attention without raising your voice?",
    content: "Struggling to get your class's attention without raising your voice? I've been refining a non-verbal cue system that has drastically reduced transition times and stress in my elementary classroom.",
    author: 'Mark Smith',
    authorAvatar: 'https://picsum.photos/seed/mark2/100',
    time: '5 hours ago',
    date: 'Oct 22',
    readTime: '3 min read',
    tags: ['Management', 'Elementary'],
    likes: 156,
    comments: 34,
    category: 'Management Tips'
  },
  {
    id: 'p3',
    title: 'Integrating AI Tools for Grading Efficiency',
    excerpt: "Let's talk about burnout. I was spending 15 hours a week just grading essays.",
    content: "Let's talk about burnout. I was spending 15 hours a week just grading essays. Here is my workflow for using new AI assistants to provide faster, more detailed feedback while saving my weekends.",
    author: 'Sarah Lee',
    authorAvatar: 'https://picsum.photos/seed/sarah2/100',
    time: '1 day ago',
    image: 'https://picsum.photos/seed/tech/800/450',
    date: 'Oct 20',
    readTime: '8 min read',
    tags: ['Technology', 'Productivity', 'High School'],
    likes: 89,
    comments: 45,
    category: 'Technology Integration'
  }
];

export const TEACHING_TIPS = [
  {
    id: 't1',
    title: 'The 5-Minute Reflection',
    content: 'End every class with a 5-minute reflection period. It helps students solidify what they learned and gives you instant feedback on the lesson.',
    author: 'Sarah Jenkins',
    authorAvatar: 'https://picsum.photos/seed/sarah/100'
  },
  {
    id: 't2',
    title: 'Gamified Vocabulary',
    content: 'Turn your vocabulary lists into a weekly competition. Use digital tools or simple classroom games to make word acquisition fun and memorable.',
    author: 'Mark Davis',
    authorAvatar: 'https://picsum.photos/seed/mark/100'
  }
];

export const TRANSACTIONS = [
  { id: 'tr1', date: 'Oct 24, 2023', description: 'Advanced Calculus Worksheets', type: 'Download Sale', amount: 50, status: 'Completed' },
  { id: 'tr2', date: 'Oct 22, 2023', description: 'Bank Transfer (Ending in 4521)', type: 'Withdrawal', amount: -1000, status: 'Pending' },
  { id: 'tr3', date: 'Oct 20, 2023', description: 'Interactive History Timeline', type: 'Download Sale', amount: 75, status: 'Completed' },
  { id: 'tr4', date: 'Oct 18, 2023', description: 'Purchased: Science Lab Bundle', type: 'Purchase', amount: -150, status: 'Completed' },
  { id: 'tr5', date: 'Oct 15, 2023', description: 'Monthly Top Contributor Bonus', type: 'Bonus Reward', amount: 200, status: 'Completed' }
];

export const ANALYTICS_DATA = [
  { name: 'Jan', coins: 400 },
  { name: 'Feb', coins: 550 },
  { name: 'Mar', coins: 450 },
  { name: 'Apr', coins: 700 },
  { name: 'May', coins: 650 },
  { name: 'Jun', coins: 900 },
];
