import {
  AuthProvider,
  FileFormat,
  ForgotPasswordPayload,
  GradeLevel,
  Language,
  LessonAttachmentPayload,
  LessonStatus,
  LessonSubject,
  LoginPayload,
  ProviderLoginPayload,
  RegisterPayload,
  ReportTargetType,
  ThemeMode,
  UserRole,
  UserStatus,
} from '../../types';

/* Re-export so existing imports from contracts still work. */
export type {
  AuthProvider,
  ForgotPasswordPayload,
  LoginPayload,
  ProviderLoginPayload,
  RegisterPayload,
};

export interface UpsertLessonPayload {
  title: string;
  description: string;
  subject: LessonSubject;
  gradeLevel: GradeLevel;
  format: FileFormat;
  price: number;
  thumbnail: string;
  duration?: string;
  estimatedMinutes?: number;
  language?: Language;
  fileSize?: string;
  attachmentSummary?: string;
  attachments?: LessonAttachmentPayload[];
  pedagogicalGoals?: string;
  keyLearnings?: string[];
  tags: string[];
  status: LessonStatus;
  versionLabel?: string;
  updateNotes?: string;
  previewMediaUrl?: string;
}

export interface CommunityPostPayload {
  title: string;
  content: string;
  category: string;
  tags: string[];
  image?: string;
}

export interface CommunityCommentPayload {
  postId: string;
  content: string;
  parentId?: string;
}

export interface CommunityReportPayload {
  targetType: 'post' | 'comment';
  targetId: string;
  reason: string;
  category: string;
}

export interface LessonReviewPayload {
  lessonId: string;
  rating: number;
  comment: string;
}

export interface LessonReportPayload {
  lessonId: string;
  targetType: ReportTargetType;
  reason: string;
  category: string;
}

export interface ProfileUpdatePayload {
  name: string;
  subject?: string;
  experience?: string;
  location?: string;
  bio?: string;
  avatar?: string;
}

export interface UpdateSettingsPayload {
  theme: ThemeMode;
  language: Language;
}

export interface AdminUpdateUserPayload {
  role?: UserRole;
  status?: UserStatus;
}

export interface AdminModerateLessonPayload {
  action: 'approve' | 'reject' | 'hide' | 'unhide';
  note?: string;
  adminId?: string;
}

export interface AdminUpdateReportPayload {
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  adminNote?: string;
}
