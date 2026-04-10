import { FileFormat, GradeLevel, LessonSubject } from '../../types';

export const APP_NAME = 'TeacherHub';
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.teacherhub.example';

export const DEFAULT_PAGE_SIZE = 6;
export const MAX_UPLOAD_FILE_MB = 50;

export const SUBJECTS: LessonSubject[] = [
  'Math',
  'Science',
  'English',
  'History',
  'Art',
  'Literature',
  'Technology',
  'Biology',
  'Earth Science',
  'STEM',
];

export const GRADE_LEVELS: GradeLevel[] = [
  'Elementary',
  'Middle School',
  'High School',
  'Grade 3',
  'Grade 4',
  'Grade 6-8',
  'Grade 7-8',
  '9th Grade',
];

export const FILE_TYPES: FileFormat[] = ['PDF', 'Word', 'PPT', 'Video', 'ZIP'];
