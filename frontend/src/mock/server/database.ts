import {
  AppNotification,
  CommunityComment,
  CommunityPost,
  Lesson,
  LessonFavorite,
  LessonReview,
  LinkedPayoutAccount,
  Order,
  Report,
  User,
  UserFollowRelation,
  Wallet,
  WalletTransaction,
} from '../../types';

export interface MockDatabase {
  users: User[];
  lessons: Lesson[];
  lessonReviews: LessonReview[];
  communityPosts: CommunityPost[];
  communityComments: CommunityComment[];
  notifications: AppNotification[];
  follows: UserFollowRelation[];
  lessonFavorites: LessonFavorite[];
  wallets: Wallet[];
  walletTransactions: WalletTransaction[];
  linkedPayoutAccounts: LinkedPayoutAccount[];
  orders: Order[];
  reports: Report[];
}

const DB_STORAGE_KEY = 'teacherhub-db-v3';

const daysAgo = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const seedUsers = (): User[] => [
  {
    id: 'u-admin',
    name: 'Admin TeacherHub',
    email: 'admin@teacherhub.dev',
    password: 'admin123',
    role: 'admin',
    status: 'active',
    avatar: 'https://picsum.photos/seed/admin/200/200',
    subject: 'Education Operations',
    experience: '12 years',
    location: 'New York, NY',
    bio: 'Platform administrator overseeing content quality and community moderation.',
    language: 'en',
    createdAt: daysAgo(700),
  },
  {
    id: 'u-sarah',
    name: 'Sarah Jenkins',
    email: 'sarah@teacherhub.dev',
    password: 'demo123',
    role: 'user',
    status: 'active',
    avatar: 'https://picsum.photos/seed/sarah/200/200',
    subject: 'Science',
    experience: '8 years',
    location: 'Seattle, WA',
    bio: 'Passionate about STEM education and hands-on project based learning.',
    language: 'en',
    createdAt: daysAgo(560),
  },
  {
    id: 'u-mark',
    name: 'Mark Davis',
    email: 'mark@teacherhub.dev',
    password: 'demo123',
    role: 'user',
    status: 'active',
    avatar: 'https://picsum.photos/seed/mark/200/200',
    subject: 'English',
    experience: '6 years',
    location: 'Austin, TX',
    bio: 'Middle school language arts teacher focused on writing fluency and reading confidence.',
    language: 'en',
    createdAt: daysAgo(510),
  },
  {
    id: 'u-linh',
    name: 'Linh Tran',
    email: 'linh@teacherhub.dev',
    password: 'demo123',
    role: 'user',
    status: 'active',
    avatar: 'https://picsum.photos/seed/linh/200/200',
    subject: 'Math',
    experience: '5 years',
    location: 'Ho Chi Minh City, VN',
    bio: 'Building practical problem-solving lessons and adaptive formative assessments.',
    language: 'vi',
    createdAt: daysAgo(360),
  },
];

const seedLessons = (): Lesson[] => [
  {
    id: 'l1',
    authorId: 'u-sarah',
    title: 'Interactive Math Games for Grade 4',
    description: 'Engaging multiplication and division stations with printable worksheets and group challenges.',
    subject: 'Math',
    gradeLevel: 'Grade 4',
    format: 'PDF',
    downloads: 1240,
    rating: 4.8,
    reviewCount: 58,
    thumbnail: 'https://picsum.photos/seed/mathgames/640/420',
    price: 0,
    duration: '60 mins',
    fileSize: '8 MB',
    pedagogicalGoals: 'Strengthen number fluency with collaborative game-based practice.',
    keyLearnings: ['Multiplication facts', 'Division strategy', 'Team collaboration'],
    status: 'published',
    createdAt: daysAgo(120),
    updatedAt: daysAgo(10),
    tags: ['math', 'games', 'grade4', 'practice'],
  },
  {
    id: 'l2',
    authorId: 'u-mark',
    title: 'Creative Writing Prompt Bank',
    description: 'Fifty flexible prompts with rubrics and feedback templates for middle school writers.',
    subject: 'English',
    gradeLevel: 'Middle School',
    format: 'Word',
    downloads: 920,
    rating: 4.9,
    reviewCount: 77,
    thumbnail: 'https://picsum.photos/seed/writingbank/640/420',
    price: 120,
    duration: '45 mins',
    fileSize: '5 MB',
    pedagogicalGoals: 'Improve idea generation and revision confidence in student writing.',
    keyLearnings: ['Narrative voice', 'Peer review', 'Revision cycles'],
    status: 'published',
    createdAt: daysAgo(160),
    updatedAt: daysAgo(14),
    tags: ['writing', 'english', 'prompts'],
  },
  {
    id: 'l3',
    authorId: 'u-sarah',
    title: 'Safe Chemistry Lab Experiments',
    description: 'Ten high-school chemistry labs with classroom safety checklist and reflection sheets.',
    subject: 'Science',
    gradeLevel: 'High School',
    format: 'PDF',
    downloads: 1470,
    rating: 4.7,
    reviewCount: 63,
    thumbnail: 'https://picsum.photos/seed/chemlab/640/420',
    price: 180,
    duration: '90 mins',
    fileSize: '14 MB',
    pedagogicalGoals: 'Develop inquiry and evidence-based reasoning in lab environments.',
    keyLearnings: ['Lab safety', 'Observation logs', 'Hypothesis testing'],
    status: 'published',
    createdAt: daysAgo(220),
    updatedAt: daysAgo(5),
    tags: ['chemistry', 'lab', 'highschool'],
  },
  {
    id: 'l4',
    authorId: 'u-linh',
    title: 'Geometry Escape Room Challenge',
    description: 'Collaborative geometry puzzle activity with printable clue packs and answer keys.',
    subject: 'Math',
    gradeLevel: 'Grade 7-8',
    format: 'PPT',
    downloads: 680,
    rating: 4.6,
    reviewCount: 34,
    thumbnail: 'https://picsum.photos/seed/geometry/640/420',
    price: 90,
    duration: '55 mins',
    fileSize: '11 MB',
    pedagogicalGoals: 'Reinforce geometric reasoning through puzzle-based teamwork.',
    keyLearnings: ['Angle relationships', 'Area reasoning', 'Problem solving'],
    status: 'published',
    createdAt: daysAgo(90),
    updatedAt: daysAgo(2),
    tags: ['geometry', 'puzzle', 'middle-school'],
  },
  {
    id: 'l5',
    authorId: 'u-mark',
    title: 'Poetry Performance Workshop',
    description: 'Student-centered poetry annotation and spoken-word practice sequence.',
    subject: 'Literature',
    gradeLevel: 'High School',
    format: 'PDF',
    downloads: 510,
    rating: 4.5,
    reviewCount: 27,
    thumbnail: 'https://picsum.photos/seed/poetry/640/420',
    price: 70,
    duration: '70 mins',
    fileSize: '6 MB',
    pedagogicalGoals: 'Build close reading and performance confidence through poetry practice.',
    keyLearnings: ['Tone analysis', 'Annotation', 'Public speaking'],
    status: 'published',
    createdAt: daysAgo(75),
    updatedAt: daysAgo(7),
    tags: ['poetry', 'literature', 'performance'],
  },
  {
    id: 'l6',
    authorId: 'u-sarah',
    title: 'Photosynthesis in Action Lab Stations',
    description: 'Hands-on lab stations and formative checks for introducing photosynthesis.',
    subject: 'Biology',
    gradeLevel: 'Grade 6-8',
    format: 'ZIP',
    downloads: 760,
    rating: 4.8,
    reviewCount: 48,
    thumbnail: 'https://picsum.photos/seed/photosynthesis/640/420',
    price: 130,
    duration: '80 mins',
    fileSize: '18 MB',
    pedagogicalGoals: 'Connect observation with plant energy transfer concepts.',
    keyLearnings: ['Photosynthesis equation', 'Lab observation', 'Concept mapping'],
    status: 'published',
    createdAt: daysAgo(66),
    updatedAt: daysAgo(4),
    tags: ['biology', 'photosynthesis', 'lab'],
  },
  {
    id: 'l7',
    authorId: 'u-linh',
    title: 'Algebra Checkpoint Quiz Pack',
    description: 'Unit checkpoint quizzes with auto-graded answer keys and mastery tracker.',
    subject: 'Math',
    gradeLevel: '9th Grade',
    format: 'Word',
    downloads: 390,
    rating: 4.4,
    reviewCount: 20,
    thumbnail: 'https://picsum.photos/seed/algebra/640/420',
    price: 50,
    duration: '40 mins',
    fileSize: '4 MB',
    pedagogicalGoals: 'Identify mastery gaps and support targeted interventions in algebra.',
    keyLearnings: ['Linear equations', 'Data interpretation', 'Mastery feedback'],
    status: 'published',
    createdAt: daysAgo(44),
    updatedAt: daysAgo(4),
    tags: ['algebra', 'assessment', 'quiz'],
  },
  {
    id: 'l8',
    authorId: 'u-sarah',
    title: 'Draft: STEM Club Launch Plan',
    description: 'A draft planning kit for launching a middle school STEM club.',
    subject: 'STEM',
    gradeLevel: 'Middle School',
    format: 'PDF',
    downloads: 0,
    rating: 0,
    reviewCount: 0,
    thumbnail: 'https://picsum.photos/seed/stemdraft/640/420',
    price: 0,
    duration: '50 mins',
    fileSize: '2 MB',
    pedagogicalGoals: 'Draft pending final review.',
    keyLearnings: ['Club charter', 'Session planning'],
    status: 'draft',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
    tags: ['stem', 'club', 'draft'],
  },
];

const seedLessonReviews = (): LessonReview[] => [
  {
    id: 'r1',
    lessonId: 'l2',
    authorId: 'u-sarah',
    rating: 5,
    comment: 'Students loved these writing prompts. Easy to adapt for mixed levels.',
    createdAt: daysAgo(13),
  },
  {
    id: 'r2',
    lessonId: 'l3',
    authorId: 'u-linh',
    rating: 4,
    comment: 'Great structure for lab safety. Added my own extension activity.',
    createdAt: daysAgo(9),
  },
  {
    id: 'r3',
    lessonId: 'l1',
    authorId: 'u-mark',
    rating: 5,
    comment: 'Quick setup and strong engagement. Thanks for sharing!',
    createdAt: daysAgo(6),
  },
];

const seedCommunityPosts = (): CommunityPost[] => [
  {
    id: 'p1',
    authorId: 'u-sarah',
    title: 'Innovative classroom stations for science labs',
    excerpt: 'How I redesigned my lab workflow to keep students active and accountable.',
    content:
      'I redesigned my middle-school lab rotations around short accountability checkpoints. Students now submit one photo reflection and one question after each station. Engagement and quality of discussion both improved.',
    image: 'https://picsum.photos/seed/community1/900/500',
    category: 'Classroom Activities',
    tags: ['science', 'stations', 'engagement'],
    likes: 41,
    likedBy: ['u-mark', 'u-linh'],
    savedBy: ['u-sarah'],
    createdAt: daysAgo(1),
  },
  {
    id: 'p2',
    authorId: 'u-mark',
    title: 'Writing conference structure that saves time',
    excerpt: 'A five-minute writing conference model that scales with large classes.',
    content:
      'Here is a conference protocol that helped me cut grading time. Students prepare with one highlight and one question before they meet me. The prep makes the conference focused and actionable.',
    category: 'Management Tips',
    tags: ['writing', 'feedback', 'workflow'],
    likes: 22,
    likedBy: ['u-sarah'],
    savedBy: [],
    createdAt: daysAgo(2),
  },
  {
    id: 'p3',
    authorId: 'u-linh',
    title: 'AI tools for quicker formative feedback',
    excerpt: 'I tested a simple AI rubric assistant for weekly quizzes.',
    content:
      'I used an AI rubric helper to generate targeted feedback comments by skill category. Students received same-day feedback while I kept the final grading decision. Sharing my process and caveats below.',
    image: 'https://picsum.photos/seed/community3/900/500',
    category: 'Technology Integration',
    tags: ['ai', 'assessment', 'productivity'],
    likes: 35,
    likedBy: ['u-mark', 'u-sarah'],
    savedBy: ['u-mark'],
    createdAt: daysAgo(3),
  },
];

const seedCommunityComments = (): CommunityComment[] => [
  {
    id: 'c1',
    postId: 'p1',
    authorId: 'u-mark',
    content: 'I like the checkpoint idea. Do you use paper or digital forms?',
    createdAt: daysAgo(1),
  },
  {
    id: 'c2',
    postId: 'p1',
    authorId: 'u-sarah',
    parentId: 'c1',
    content: 'Mostly digital forms in Google Classroom. I can share the template if useful.',
    createdAt: daysAgo(1),
  },
  {
    id: 'c3',
    postId: 'p2',
    authorId: 'u-linh',
    content: 'Thanks! I adapted this for math check-ins and it worked well.',
    createdAt: daysAgo(1),
  },
];

const seedNotifications = (): AppNotification[] => [
  {
    id: 'notif-1',
    userId: 'u-sarah',
    type: 'community',
    title: 'New comment on your discussion',
    message: 'Mark Davis replied to "Innovative classroom stations for science labs".',
    actionUrl: '/community/p1',
    actionLabel: 'View discussion',
    read: false,
    actorUserId: 'u-mark',
    entityType: 'comment',
    entityId: 'c1',
    createdAt: daysAgo(0.4),
  },
  {
    id: 'notif-2',
    userId: 'u-sarah',
    type: 'order',
    title: 'Lesson purchase completed',
    message: 'You earned 180 coins from "Safe Chemistry Lab Experiments".',
    actionUrl: '/orders',
    actionLabel: 'Open orders',
    read: false,
    entityType: 'order',
    entityId: 'o1',
    createdAt: daysAgo(1.2),
  },
  {
    id: 'notif-3',
    userId: 'u-mark',
    type: 'system',
    title: 'Welcome to TeacherHub notifications',
    message: 'Stay updated with follows, comments, and order activity in one place.',
    actionUrl: '/dashboard',
    actionLabel: 'Open dashboard',
    read: true,
    readAt: daysAgo(2.2),
    entityType: 'system',
    entityId: 'system-welcome',
    createdAt: daysAgo(2.5),
  },
  {
    id: 'notif-4',
    userId: 'u-linh',
    type: 'follow',
    title: 'You have a new follower',
    message: 'Sarah Jenkins started following your teacher profile.',
    actionUrl: '/community',
    actionLabel: 'Explore community',
    read: false,
    actorUserId: 'u-sarah',
    entityType: 'user',
    entityId: 'u-sarah',
    createdAt: daysAgo(0.7),
  },
];

const seedFollows = (): UserFollowRelation[] => [
  {
    followerId: 'u-sarah',
    followingId: 'u-linh',
    createdAt: daysAgo(6),
    source: 'manual',
  },
  {
    followerId: 'u-mark',
    followingId: 'u-sarah',
    createdAt: daysAgo(9),
    source: 'suggestion',
  },
  {
    followerId: 'u-linh',
    followingId: 'u-mark',
    createdAt: daysAgo(4),
    source: 'imported',
  },
];

const seedLessonFavorites = (): LessonFavorite[] => [
  {
    userId: 'u-mark',
    lessonId: 'l1',
    createdAt: daysAgo(5),
    source: 'library',
  },
  {
    userId: 'u-linh',
    lessonId: 'l3',
    createdAt: daysAgo(3),
    source: 'lesson_detail',
  },
  {
    userId: 'u-sarah',
    lessonId: 'l2',
    createdAt: daysAgo(1),
    source: 'teacher_profile',
  },
];

const seedWallets = (): Wallet[] => [
  { userId: 'u-admin', balance: 10000 },
  { userId: 'u-sarah', balance: 2450 },
  { userId: 'u-mark', balance: 1600 },
  { userId: 'u-linh', balance: 920 },
];

const seedWalletTransactions = (): WalletTransaction[] => [
  {
    id: 'tx1',
    userId: 'u-sarah',
    date: daysAgo(2),
    description: 'Sale: Creative Writing Prompt Bank',
    type: 'sale',
    amount: 120,
    status: 'completed',
  },
  {
    id: 'tx2',
    userId: 'u-sarah',
    date: daysAgo(5),
    description: 'Withdrawal to bank account',
    type: 'withdrawal',
    amount: -300,
    status: 'pending',
  },
  {
    id: 'tx3',
    userId: 'u-mark',
    date: daysAgo(2),
    description: 'Purchase: Safe Chemistry Lab Experiments',
    type: 'purchase',
    amount: -180,
    status: 'completed',
  },
  {
    id: 'tx4',
    userId: 'u-linh',
    date: daysAgo(7),
    description: 'Top-up via card',
    type: 'topup',
    amount: 500,
    status: 'completed',
  },
  {
    id: 'tx5',
    userId: 'u-mark',
    date: daysAgo(12),
    description: 'Monthly contributor bonus',
    type: 'bonus',
    amount: 80,
    status: 'completed',
  },
];

const seedLinkedPayoutAccounts = (): LinkedPayoutAccount[] => [
  {
    id: 'payout-1',
    userId: 'u-sarah',
    targetType: 'bank',
    providerName: 'Vietcombank',
    accountIdentifier: '0123456789',
    accountOwnerName: 'Sarah Jenkins',
    isDefault: true,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(8),
  },
  {
    id: 'payout-2',
    userId: 'u-sarah',
    targetType: 'momo',
    providerName: 'MoMo Wallet',
    accountIdentifier: '0901234567',
    accountOwnerName: 'Sarah Jenkins',
    isDefault: true,
    createdAt: daysAgo(22),
    updatedAt: daysAgo(9),
  },
  {
    id: 'payout-3',
    userId: 'u-mark',
    targetType: 'paypal',
    providerName: 'PayPal',
    accountIdentifier: 'mark.teacher@paypal.com',
    accountOwnerName: 'Mark Davis',
    isDefault: true,
    createdAt: daysAgo(41),
    updatedAt: daysAgo(12),
  },
];

const seedOrders = (): Order[] => [
  {
    id: 'o1',
    userId: 'u-mark',
    lessonId: 'l3',
    lessonAuthorId: 'u-sarah',
    amount: 180,
    status: 'paid',
    paymentStatus: 'success',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    paidAt: daysAgo(2),
    paymentRef: 'PAY-1001',
    paymentMethod: 'wallet',
    entitlementGrantedAt: daysAgo(2),
    entitlementSource: 'payment_confirmed',
  },
  {
    id: 'o2',
    userId: 'u-linh',
    lessonId: 'l2',
    lessonAuthorId: 'u-mark',
    amount: 120,
    status: 'failed',
    paymentStatus: 'failed',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
    failedAt: daysAgo(4),
    paymentRef: 'PAY-1002',
    paymentMethod: 'wallet',
  },
];

const seedReports = (): Report[] => [
  {
    id: 'rpt-1',
    reporterId: 'u-mark',
    targetType: 'post',
    targetId: 'p1',
    reason: 'Misleading information in lab safety section',
    category: 'Misinformation',
    status: 'pending',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: 'rpt-2',
    reporterId: 'u-linh',
    targetType: 'comment',
    targetId: 'c1',
    reason: 'Spam content with external links',
    category: 'Spam',
    status: 'reviewing',
    adminNote: 'Checking linked URLs for safety.',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
  },
  {
    id: 'rpt-3',
    reporterId: 'u-sarah',
    targetType: 'lesson',
    targetId: 'l4',
    reason: 'Copyrighted material used without attribution',
    category: 'Copyright',
    status: 'resolved',
    adminNote: 'Author updated with proper attribution.',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(5),
  },
  {
    id: 'rpt-4',
    reporterId: 'u-mark',
    targetType: 'user',
    targetId: 'u-linh',
    reason: 'Suspected bot account behavior',
    category: 'Suspicious Activity',
    status: 'dismissed',
    adminNote: 'Account verified as legitimate educator.',
    createdAt: daysAgo(14),
    updatedAt: daysAgo(12),
  },
];

const createSeedDatabase = (): MockDatabase => ({
  users: seedUsers(),
  lessons: seedLessons(),
  lessonReviews: seedLessonReviews(),
  communityPosts: seedCommunityPosts(),
  communityComments: seedCommunityComments(),
  notifications: seedNotifications(),
  follows: seedFollows(),
  lessonFavorites: seedLessonFavorites(),
  wallets: seedWallets(),
  walletTransactions: seedWalletTransactions(),
  linkedPayoutAccounts: seedLinkedPayoutAccounts(),
  orders: seedOrders(),
  reports: seedReports(),
});

const hasStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const isValidDatabaseShape = (value: unknown): value is MockDatabase => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.users) &&
    Array.isArray(record.lessons) &&
    Array.isArray(record.lessonReviews) &&
    Array.isArray(record.communityPosts) &&
    Array.isArray(record.communityComments) &&
    Array.isArray(record.notifications) &&
    Array.isArray(record.follows) &&
    Array.isArray(record.lessonFavorites) &&
    Array.isArray(record.wallets) &&
    Array.isArray(record.walletTransactions) &&
    Array.isArray(record.orders) &&
    Array.isArray(record.reports)
  );
};

export const getDatabase = (): MockDatabase => {
  if (!hasStorage()) {
    return createSeedDatabase();
  }

  const existing = window.localStorage.getItem(DB_STORAGE_KEY);
  if (!existing) {
    const seeded = createSeedDatabase();
    window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(seeded));
    return clone(seeded);
  }

  try {
    const parsed = JSON.parse(existing);
    if (isValidDatabaseShape(parsed)) {
      const maybeLinked = (parsed as { linkedPayoutAccounts?: unknown }).linkedPayoutAccounts;
      const upgraded: MockDatabase = {
        ...(parsed as Omit<MockDatabase, 'linkedPayoutAccounts'>),
        linkedPayoutAccounts: Array.isArray(maybeLinked) ? (maybeLinked as LinkedPayoutAccount[]) : [],
      };

      if (!Array.isArray(maybeLinked)) {
        window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(upgraded));
      }

      return clone(upgraded);
    }
  } catch {
    // ignored - reinitialize below
  }

  const fallback = createSeedDatabase();
  window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(fallback));
  return clone(fallback);
};

export const saveDatabase = (database: MockDatabase): void => {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(database));
};

export const updateDatabase = (
  updater: (draft: MockDatabase) => MockDatabase | void,
): MockDatabase => {
  const draft = getDatabase();
  const candidate = updater(draft);
  const updated: MockDatabase = (candidate ?? draft) as MockDatabase;
  saveDatabase(updated);
  return clone(updated);
};

export const resetDatabase = (): void => {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.removeItem(DB_STORAGE_KEY);
};

export const withLatency = async <T>(value: T, delayMs = 220): Promise<T> =>
  new Promise((resolve) => {
    window.setTimeout(() => resolve(clone(value)), delayMs);
  });
