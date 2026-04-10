import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../app/providers/LanguageProvider';
import {
  CloudUpload,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Info,
  Tag,
  Layers,
  DollarSign,
  Loader2,
  FileArchive,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FILE_TYPES, GRADE_LEVELS, MAX_UPLOAD_FILE_MB, SUBJECTS } from '../../app/config/constants';
import { lessonsService } from '../../services/lessonsService';
import type { UpsertLessonPayload } from '../../services/lessonsService';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { FileFormat, GradeLevel, Language, Lesson, LessonStatus, LessonSubject } from '../../types';

type UploadFormState = {
  title: string;
  description: string;
  subject: LessonSubject;
  gradeLevel: GradeLevel;
  format: FileFormat;
  language: Language;
  tags: string;
  pedagogicalGoals: string;
  keyLearnings: string;
  duration: string;
  estimatedMinutes: string;
  fileSize: string;
  attachmentSummary: string;
  attachmentFileName: string;
  attachmentMimeType: string;
  attachmentStorageKey: string;
  attachmentUploadToken: string;
  attachmentChecksum: string;
  attachmentUrl: string;
  thumbnail: string;
  previewMediaUrl: string;
  priceType: 'free' | 'paid';
  price: string;
  versionLabel: string;
  updateNotes: string;
  publishNow: boolean;
};

type LocalAttachment = {
  name: string;
  sizeMb: number;
  mimeType: string;
};

const DEFAULT_THUMBNAIL = 'https://picsum.photos/seed/new-lesson/800/600';
const FILE_ACCEPT_LIST = '.pdf,.doc,.docx,.ppt,.pptx,.zip,.mp4,.mov,.avi,.m4v,.webm';
const LESSON_LANGUAGES: Array<{ label: string; value: Language }> = [
  { label: 'English', value: 'en' },
  { label: 'Vietnamese', value: 'vi' },
];
const MAX_TAG_COUNT = 12;
const MAX_TAG_LENGTH = 24;
const MAX_LESSON_PRICE = 50_000;
const SAFE_EDIT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

const initialForm: UploadFormState = {
  title: '',
  description: '',
  subject: SUBJECTS[0],
  gradeLevel: GRADE_LEVELS[0],
  format: FILE_TYPES[0],
  language: 'en',
  tags: '',
  pedagogicalGoals: '',
  keyLearnings: '',
  duration: '45 mins',
  estimatedMinutes: '45',
  fileSize: '',
  attachmentSummary: '',
  attachmentFileName: '',
  attachmentMimeType: '',
  attachmentStorageKey: '',
  attachmentUploadToken: '',
  attachmentChecksum: '',
  attachmentUrl: '',
  thumbnail: DEFAULT_THUMBNAIL,
  previewMediaUrl: '',
  priceType: 'free',
  price: '0',
  versionLabel: 'v1.0',
  updateNotes: '',
  publishNow: true,
};

const steps = [
  { id: 1, title: 'Basic Info', icon: <Info size={18} /> },
  { id: 2, title: 'Details', icon: <Layers size={18} /> },
  { id: 3, title: 'File Upload', icon: <CloudUpload size={18} /> },
  { id: 4, title: 'Pricing', icon: <DollarSign size={18} /> },
];

const parseCommaList = (value: string): string[] => {
  const unique = new Map<string, string>();

  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const normalizedKey = item.toLowerCase();
      if (!unique.has(normalizedKey)) {
        unique.set(normalizedKey, item);
      }
    });

  return Array.from(unique.values());
};

const toSafeEditLessonId = (value: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return SAFE_EDIT_ID_PATTERN.test(trimmed) ? trimmed : null;
};

const isValidHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const isValidAssetUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith('data:image/')) {
    return true;
  }

  return isValidHttpUrl(trimmed);
};

const parseFileSizeMb = (value: string): number | null => {
  const normalized = value.trim().toLowerCase().replaceAll(' ', '');
  if (!normalized) {
    return null;
  }

  const numericPart = normalized.endsWith('mb') ? normalized.slice(0, -2) : normalized;
  const mb = Number(numericPart);
  if (!Number.isFinite(mb) || mb <= 0) {
    return null;
  }

  return Number(mb.toFixed(2));
};

const parseEstimatedMinutes = (value: string): number | null => {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
};

const inferFormatFromFile = (fileName: string, mimeType: string): FileFormat | null => {
  const normalizedName = fileName.trim().toLowerCase();
  const normalizedMime = mimeType.trim().toLowerCase();

  if (normalizedName.endsWith('.pdf') || normalizedMime === 'application/pdf') {
    return 'PDF';
  }

  if (
    normalizedName.endsWith('.doc') ||
    normalizedName.endsWith('.docx') ||
    normalizedMime.includes('wordprocessingml') ||
    normalizedMime.includes('msword')
  ) {
    return 'Word';
  }

  if (
    normalizedName.endsWith('.ppt') ||
    normalizedName.endsWith('.pptx') ||
    normalizedMime.includes('presentation')
  ) {
    return 'PPT';
  }

  if (
    normalizedName.endsWith('.mp4') ||
    normalizedName.endsWith('.mov') ||
    normalizedName.endsWith('.avi') ||
    normalizedName.endsWith('.m4v') ||
    normalizedName.endsWith('.webm') ||
    normalizedMime.startsWith('video/')
  ) {
    return 'Video';
  }

  if (normalizedName.endsWith('.zip') || normalizedMime.includes('zip')) {
    return 'ZIP';
  }

  return null;
};

const mapLessonToForm = (lesson: Lesson): UploadFormState => {
  const primaryAttachment = lesson.attachments?.[0];

  return {
    title: lesson.title,
    description: lesson.description,
    subject: lesson.subject,
    gradeLevel: lesson.gradeLevel,
    format: lesson.format,
    language: lesson.language ?? 'en',
    tags: lesson.tags.join(', '),
    pedagogicalGoals: lesson.pedagogicalGoals ?? '',
    keyLearnings: (lesson.keyLearnings ?? []).join(', '),
    duration: lesson.duration ?? '45 mins',
    estimatedMinutes: lesson.estimatedMinutes ? String(lesson.estimatedMinutes) : '45',
    fileSize:
      lesson.fileSize ??
      (typeof primaryAttachment?.sizeMb === 'number' ? `${primaryAttachment.sizeMb}MB` : ''),
    attachmentSummary: lesson.attachmentSummary ?? '',
    attachmentFileName: primaryAttachment?.fileName ?? '',
    attachmentMimeType: primaryAttachment?.mimeType ?? '',
    attachmentStorageKey: primaryAttachment?.storageKey ?? '',
    attachmentUploadToken: primaryAttachment?.uploadToken ?? '',
    attachmentChecksum: primaryAttachment?.checksum ?? '',
    attachmentUrl: primaryAttachment?.url ?? '',
    thumbnail: lesson.thumbnail || DEFAULT_THUMBNAIL,
    previewMediaUrl: lesson.previewMediaUrl ?? '',
    priceType: lesson.price > 0 ? 'paid' : 'free',
    price: lesson.price > 0 ? String(lesson.price) : '0',
    versionLabel: lesson.versionLabel ?? 'v1.0',
    updateNotes: lesson.updateNotes ?? '',
    publishNow: lesson.status === 'published',
  };
};

const isStepValid = (step: number, form: UploadFormState, isEditMode: boolean): boolean => {
  if (step === 1) {
    return form.title.trim().length >= 8 && form.description.trim().length >= 20;
  }

  if (step === 2) {
    const tags = parseCommaList(form.tags);
    const estimatedMinutes = parseEstimatedMinutes(form.estimatedMinutes);

    return (
      tags.length > 0 &&
      tags.length <= MAX_TAG_COUNT &&
      tags.every((tag) => tag.length <= MAX_TAG_LENGTH) &&
      estimatedMinutes !== null
    );
  }

  if (step === 3) {
    const fileSizeMb = parseFileSizeMb(form.fileSize);
    const previewMedia = form.previewMediaUrl.trim();

    return (
      form.duration.trim().length > 0 &&
      form.attachmentSummary.trim().length >= 10 &&
      fileSizeMb !== null &&
      fileSizeMb <= MAX_UPLOAD_FILE_MB &&
      isValidAssetUrl(form.thumbnail) &&
      (!previewMedia || isValidHttpUrl(previewMedia))
    );
  }

  if (step === 4) {
    if (form.priceType === 'paid') {
      const amount = Number(form.price);
      if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_LESSON_PRICE) {
        return false;
      }
    }

    if (isEditMode && !form.updateNotes.trim()) {
      return false;
    }

    return true;
  }

  return false;
};

const validateForm = (form: UploadFormState, isEditMode: boolean): string[] => {
  const errors: string[] = [];

  if (form.title.trim().length < 8) {
    errors.push('Lesson title must be at least 8 characters.');
  }

  if (form.description.trim().length < 20) {
    errors.push('Description must be at least 20 characters.');
  }

  const tags = parseCommaList(form.tags);
  if (tags.length === 0) {
    errors.push('Please add at least one tag.');
  } else {
    if (tags.length > MAX_TAG_COUNT) {
      errors.push(`Use ${MAX_TAG_COUNT} tags or fewer to keep metadata focused.`);
    }

    if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
      errors.push(`Each tag must be ${MAX_TAG_LENGTH} characters or fewer.`);
    }
  }

  if (!form.duration.trim()) {
    errors.push('Please provide the lesson duration.');
  }

  const estimatedMinutes = parseEstimatedMinutes(form.estimatedMinutes);
  if (estimatedMinutes === null) {
    errors.push('Estimated learning time must be a valid number of minutes.');
  } else if (estimatedMinutes > 600) {
    errors.push('Estimated learning time should be 600 minutes or less.');
  }

  const fileSizeMb = parseFileSizeMb(form.fileSize);
  if (fileSizeMb === null) {
    errors.push('File size is required and must be a valid number in MB.');
  } else if (fileSizeMb > MAX_UPLOAD_FILE_MB) {
    errors.push(`File size must be ${MAX_UPLOAD_FILE_MB}MB or less.`);
  }

  if (form.attachmentSummary.trim().length < 10) {
    errors.push('Please provide clearer attachment details (at least 10 characters).');
  }

  if (!isValidAssetUrl(form.thumbnail)) {
    errors.push('Thumbnail URL must be a valid http(s) URL or image data URL.');
  }

  const previewMedia = form.previewMediaUrl.trim();
  if (previewMedia && !isValidHttpUrl(previewMedia)) {
    errors.push('Preview media URL must be a valid http(s) URL.');
  }

  if (form.priceType === 'paid') {
    const amount = Number(form.price);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push('Paid lessons require a price greater than 0.');
    } else if (amount > MAX_LESSON_PRICE) {
      errors.push(`Price must be ${MAX_LESSON_PRICE} coins or less.`);
    }
  }

  if (isEditMode && !form.updateNotes.trim()) {
    errors.push('Please add update notes so learners understand what changed.');
  }

  return errors;
};

const buildPayload = (form: UploadFormState): UpsertLessonPayload => {
  const status: LessonStatus = form.publishNow ? 'published' : 'draft';
  const estimatedMinutes = parseEstimatedMinutes(form.estimatedMinutes);
  const trimmedPreviewMedia = form.previewMediaUrl.trim();
  const normalizedPrice = Number.isFinite(Number(form.price))
    ? Math.max(0, Math.round(Number(form.price)))
    : 0;
  const normalizedFileSizeMb = parseFileSizeMb(form.fileSize);
  const normalizedAttachmentSizeMb = normalizedFileSizeMb ?? undefined;
  const normalizedAttachmentFileName =
    form.attachmentFileName.trim() ||
    `${form.title.trim() || 'lesson-resource'}.${form.format.toLowerCase()}`;
  const normalizedAttachmentMimeType = form.attachmentMimeType.trim();
  const normalizedAttachmentUrl = form.attachmentUrl.trim();

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    subject: form.subject,
    gradeLevel: form.gradeLevel,
    format: form.format,
    price: form.priceType === 'free' ? 0 : Math.min(normalizedPrice, MAX_LESSON_PRICE),
    thumbnail: form.thumbnail.trim(),
    duration: form.duration.trim(),
    estimatedMinutes: estimatedMinutes ?? undefined,
    language: form.language,
    fileSize: normalizedFileSizeMb !== null ? `${normalizedFileSizeMb}MB` : form.fileSize.trim(),
    attachmentSummary: form.attachmentSummary.trim(),
    attachments: [
      {
        fileName: normalizedAttachmentFileName,
        mimeType: normalizedAttachmentMimeType || undefined,
        sizeMb: normalizedAttachmentSizeMb,
        format: form.format,
        source: normalizedAttachmentUrl ? 'remote' : 'local',
        storageKey: form.attachmentStorageKey.trim() || undefined,
        uploadToken: form.attachmentUploadToken.trim() || undefined,
        checksum: form.attachmentChecksum.trim() || undefined,
        url: normalizedAttachmentUrl || undefined,
      },
    ],
    pedagogicalGoals: form.pedagogicalGoals.trim() || undefined,
    keyLearnings: parseCommaList(form.keyLearnings),
    tags: parseCommaList(form.tags),
    status,
    versionLabel: form.versionLabel.trim() || undefined,
    updateNotes: form.updateNotes.trim() || undefined,
    previewMediaUrl: trimmedPreviewMedia || undefined,
  };
};

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<UploadFormState>(initialForm);
  const [localAttachment, setLocalAttachment] = useState<LocalAttachment | null>(null);

  const rawEditQuery = searchParams.get('edit');

  const editLessonId = useMemo(
    () => toSafeEditLessonId(rawEditQuery),
    [rawEditQuery],
  );

  const isEditMode = Boolean(editLessonId);
  const malformedEditQuery = searchParams.has('edit') && rawEditQuery !== null && !editLessonId;

  useEffect(() => {
    if (!editLessonId) {
      setEditLoadError(null);
      setLoadingEditData(false);
      return;
    }

    if (!user) {
      setEditLoadError(t('upload.signInToEdit'));
      return;
    }

    let active = true;
    setLoadingEditData(true);
    setEditLoadError(null);

    const loadExistingLesson = async (): Promise<void> => {
      try {
        const lesson = await lessonsService.getLessonById(editLessonId);
        if (!active) {
          return;
        }

        if (!lesson) {
          setEditLoadError(t('upload.lessonNotFound'));
          return;
        }

        if (lesson.authorId !== user.id) {
          setEditLoadError(t('upload.notYourLesson'));
          return;
        }

        setForm(mapLessonToForm(lesson));
        setStep(1);
        setLocalAttachment(null);
      } catch {
        if (active) {
          setEditLoadError(t('upload.unableToLoadLesson'));
        }
      } finally {
        if (active) {
          setLoadingEditData(false);
        }
      }
    };

    void loadExistingLesson();

    return () => {
      active = false;
    };
  }, [editLessonId, user]);

  const canAdvance = useMemo(() => isStepValid(step, form, isEditMode), [form, step, isEditMode]);

  const setField = <K extends keyof UploadFormState>(key: K, value: UploadFormState[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const switchToCreateMode = (): void => {
    const next = new URLSearchParams(searchParams);
    next.delete('edit');
    setSearchParams(next, { replace: true });

    setForm(initialForm);
    setStep(1);
    setEditLoadError(null);
    setLocalAttachment(null);
  };

  const nextStep = (): void => {
    if (!canAdvance) {
      showToast({ type: 'info', message: t('upload.completeFieldsFirst') });
      return;
    }

    setStep((current) => Math.min(4, current + 1));
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const sizeMb = Number((file.size / (1024 * 1024)).toFixed(2));
    if (sizeMb > MAX_UPLOAD_FILE_MB) {
      showToast({
        type: 'error',
        message: t('upload.fileTooLarge', { values: { max: MAX_UPLOAD_FILE_MB } }),
      });
      event.target.value = '';
      return;
    }

    const inferredFormat = inferFormatFromFile(file.name, file.type);

    const attachment: LocalAttachment = {
      name: file.name,
      sizeMb,
      mimeType: file.type || 'application/octet-stream',
    };

    setLocalAttachment(attachment);
    setField('fileSize', `${attachment.sizeMb}MB`);
    setField('attachmentSummary', `${attachment.name} (${attachment.mimeType || 'file'})`);
    setField('attachmentFileName', attachment.name);
    setField('attachmentMimeType', attachment.mimeType);
    setField('attachmentStorageKey', '');
    setField('attachmentUploadToken', '');
    setField('attachmentChecksum', '');
    setField('attachmentUrl', '');

    if (inferredFormat) {
      setField('format', inferredFormat);
    }

    showToast({
      type: 'success',
      message: t('upload.attachmentCaptured'),
    });

    event.target.value = '';
  };

  const clearAttachment = (): void => {
    setLocalAttachment(null);
    setField('attachmentSummary', '');
    setField('fileSize', '');
    setField('attachmentFileName', '');
    setField('attachmentMimeType', '');
    setField('attachmentStorageKey', '');
    setField('attachmentUploadToken', '');
    setField('attachmentChecksum', '');
    setField('attachmentUrl', '');
  };

  const submitLesson = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!user || saving) {
      return;
    }

    const validationErrors = validateForm(form, isEditMode);
    if (validationErrors.length > 0) {
      showToast({ type: 'error', message: validationErrors[0] });
      return;
    }

    const payload = buildPayload(form);

    setSaving(true);
    try {
      if (isEditMode && editLessonId) {
        await lessonsService.updateLesson(editLessonId, user.id, payload);
      } else {
        await lessonsService.createLesson(user.id, payload);
      }

      const lifecycleVerb = payload.status === 'published' ? t('upload.published') : t('upload.savedAsDraft');
      showToast({
        type: 'success',
        message: isEditMode
          ? t('upload.lessonUpdated', { values: { verb: lifecycleVerb } })
          : t('upload.lessonCreated', { values: { verb: lifecycleVerb } }),
      });

      setForm(initialForm);
      setStep(1);
      setLocalAttachment(null);

      if (isEditMode) {
        const next = new URLSearchParams(searchParams);
        next.delete('edit');
        setSearchParams(next, { replace: true });
      }

      navigate('/dashboard', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('upload.unableToSaveLesson');
      showToast({ type: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const submitLabel =
    saving
      ? isEditMode
        ? t('upload.savingChanges')
        : t('upload.submitting')
      : form.publishNow
      ? isEditMode
        ? t('upload.updatePublish')
        : t('upload.publishLesson')
      : isEditMode
      ? t('upload.updateDraft')
      : t('upload.saveDraft');

  const summaryTags = parseCommaList(form.tags);
  const summaryKeyLearnings = parseCommaList(form.keyLearnings);
  const summaryFileSize = parseFileSizeMb(form.fileSize);
  const summaryPriceRaw = Number(form.price);
  const summaryPriceLabel =
    form.priceType === 'free'
      ? t('upload.free')
      : Number.isFinite(summaryPriceRaw) && summaryPriceRaw > 0
      ? `${Math.round(summaryPriceRaw)} ${t('upload.coins')}`
      : t('upload.premiumSetPrice');
  const summaryVisibilityLabel = form.publishNow ? t('upload.publishNow') : t('upload.saveAsDraftLabel');

  if (loadingEditData) {
    return (
      <LoadingState
        title={t('upload.loadingLessonEdit')}
        description={t('upload.loadingLessonEditDescription')}
      />
    );
  }

  if (editLoadError) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-20">
        <EmptyState
          title={t('upload.unableToOpenEditMode')}
          description={editLoadError}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={switchToCreateMode}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
              >
                {t('upload.openCreateMode')}
              </button>
              <Link
                to="/dashboard"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                {t('upload.backToDashboard')}
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <form onSubmit={submitLesson} className="mx-auto flex w-full max-w-4xl flex-col gap-10 pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black tracking-tight">
            {isEditMode ? t('upload.editLessonPlan') : t('upload.uploadLessonPlan')}
          </h1>
          <Link
            to="/dashboard"
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
          >
            {t('upload.backToDashboard')}
          </Link>
        </div>
        <p className="text-slate-500">
          {isEditMode
            ? t('upload.editDescription')
            : t('upload.createDescription')}
        </p>
      </div>

      {malformedEditQuery ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Invalid <code>edit</code> query detected. Please use a valid lesson id (letters, numbers, <code>-</code>, <code>_</code>). The form is now in create mode.
        </div>
      ) : null}

      <div className="relative flex items-center justify-between px-4">
        <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-slate-100 dark:bg-slate-800" />
        {steps.map((entry) => (
          <div key={entry.id} className="relative z-10 flex flex-col items-center gap-3">
            <div
              className={`flex size-10 items-center justify-center rounded-full border-4 transition-all ${
                step >= entry.id
                  ? 'border-primary bg-primary text-white'
                  : 'border-slate-100 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              {step > entry.id ? <CheckCircle size={20} /> : entry.icon}
            </div>
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                step >= entry.id ? 'text-primary' : 'text-slate-400'
              }`}
            >
              {entry.title}
            </span>
          </div>
        ))}
      </div>

      <div className="flex min-h-[460px] flex-col rounded-3xl border border-slate-200 bg-white p-10 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {step === 1 ? (
          <div className="flex animate-in flex-col gap-8 fade-in slide-in-from-bottom-4 duration-500">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.lessonTitle')}</span>
              <input
                required
                value={form.title}
                onChange={(event) => setField('title', event.target.value)}
                placeholder={t('upload.titlePlaceholder')}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.description')}</span>
              <textarea
                required
                rows={6}
                value={form.description}
                onChange={(event) => setField('description', event.target.value)}
                placeholder={t('upload.descriptionPlaceholder')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid animate-in gap-8 fade-in slide-in-from-bottom-4 duration-500 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.subject')}</span>
              <select
                value={form.subject}
                onChange={(event) => setField('subject', event.target.value as LessonSubject)}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
              >
                {SUBJECTS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.gradeLevel')}</span>
              <select
                value={form.gradeLevel}
                onChange={(event) => setField('gradeLevel', event.target.value as GradeLevel)}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
              >
                {GRADE_LEVELS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.lessonLanguage')}</span>
              <select
                value={form.language}
                onChange={(event) => setField('language', event.target.value as Language)}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
              >
                {LESSON_LANGUAGES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.estimatedLearningTime')}</span>
              <input
                type="number"
                min={1}
                max={600}
                value={form.estimatedMinutes}
                onChange={(event) => setField('estimatedMinutes', event.target.value)}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
              />
            </label>

            <label className="md:col-span-2 flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.tags')}</span>
              <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-slate-800">
                <Tag size={18} className="mr-2 text-slate-400" />
                <input
                  required
                  value={form.tags}
                  onChange={(event) => setField('tags', event.target.value)}
                  placeholder={t('upload.tagsPlaceholder')}
                  className="w-full border-none bg-transparent focus:ring-0"
                />
              </div>
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.pedagogicalGoals')}</span>
              <textarea
                rows={4}
                value={form.pedagogicalGoals}
                onChange={(event) => setField('pedagogicalGoals', event.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
              />
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {t('upload.keyLearnings')}
              </span>
              <input
                value={form.keyLearnings}
                onChange={(event) => setField('keyLearnings', event.target.value)}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex animate-in flex-col gap-6 fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-4 border-dashed border-slate-100 p-12 dark:border-slate-800">
              <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CloudUpload size={40} />
              </div>
              <div className="text-center">
                <h3 className="mb-2 text-xl font-bold">{t('upload.resourceFileMetadata')}</h3>
                <p className="text-sm text-slate-500">
                  {t('upload.resourceFileMetadataDescription')}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.fileFormat')}</span>
                <select
                  value={form.format}
                  onChange={(event) => setField('format', event.target.value as FileFormat)}
                  className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                >
                  {FILE_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {t('upload.fileSize')}
                </span>
                <input
                  value={form.fileSize}
                  onChange={(event) => setField('fileSize', event.target.value)}
                  placeholder={`Up to ${MAX_UPLOAD_FILE_MB}MB`}
                  className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                />
              </label>

              <label className="md:col-span-2 flex flex-col gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.selectAttachment')}</span>
                <input
                  type="file"
                  accept={FILE_ACCEPT_LIST}
                  onChange={handleAttachmentChange}
                  className="block w-full text-sm font-medium text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:font-semibold file:text-primary hover:file:bg-primary/20"
                />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Local files are used for metadata capture in this mocked environment. Max {MAX_UPLOAD_FILE_MB}MB.
                </p>
                {localAttachment ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <FileArchive size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-200">{localAttachment.name}</p>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {localAttachment.sizeMb}MB • {localAttachment.mimeType}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearAttachment}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:border-rose-400 hover:text-rose-500 dark:border-slate-700"
                    >
                      <Trash2 size={14} /> {t('upload.clear')}
                    </button>
                  </div>
                ) : null}
              </label>

              <label className="md:col-span-2 flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.attachmentSummary')}</span>
                <textarea
                  rows={3}
                  value={form.attachmentSummary}
                  onChange={(event) => setField('attachmentSummary', event.target.value)}
                  placeholder={t('upload.attachmentSummaryPlaceholder')}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.lessonDuration')}</span>
                <input
                  value={form.duration}
                  onChange={(event) => setField('duration', event.target.value)}
                  className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.thumbnailUrl')}</span>
                <input
                  value={form.thumbnail}
                  onChange={(event) => setField('thumbnail', event.target.value)}
                  className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                />
              </label>

              <label className="md:col-span-2 flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.previewMediaUrl')}</span>
                <input
                  value={form.previewMediaUrl}
                  onChange={(event) => setField('previewMediaUrl', event.target.value)}
                  placeholder="https://..."
                  className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="flex animate-in flex-col items-center gap-8 fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-md text-center">
              <h3 className="mb-4 text-xl font-bold">{t('upload.setPricingVisibility')}</h3>
              <p className="text-sm text-slate-500">
                {t('upload.pricingDescription')}
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() => {
                  setField('priceType', 'free');
                  setField('price', '0');
                }}
                className={`flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 p-6 transition-all ${
                  form.priceType === 'free'
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-100 hover:border-primary/50 dark:border-slate-800'
                }`}
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-primary text-white">
                  <span className="font-black">F</span>
                </div>
                <div className="text-center">
                  <h4 className="font-bold">{t('upload.free')}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {t('upload.communityContribution')}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setField('priceType', 'paid')}
                className={`flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 p-6 transition-all ${
                  form.priceType === 'paid'
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-100 hover:border-primary/50 dark:border-slate-800'
                }`}
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-yellow-500 text-white">
                  <DollarSign size={24} />
                </div>
                <div className="text-center">
                  <h4 className="font-bold">{t('upload.premium')}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t('upload.earnCoins')}</p>
                </div>
              </button>
            </div>

            {form.priceType === 'paid' ? (
              <label className="w-full max-w-sm space-y-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.priceCoins')}</span>
                <input
                  type="number"
                  min={1}
                  value={form.price}
                  onChange={(event) => setField('price', event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            ) : null}

            <div className="w-full space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('upload.releaseVersionLabel')}</span>
                <input
                  value={form.versionLabel}
                  onChange={(event) => setField('versionLabel', event.target.value)}
                  placeholder="v1.0"
                  className="h-12 rounded-xl border border-slate-200 bg-white px-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-900"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {isEditMode ? t('upload.updateNotesRequired') : t('upload.updateNotesOptional')}
                </span>
                <textarea
                  rows={3}
                  value={form.updateNotes}
                  onChange={(event) => setField('updateNotes', event.target.value)}
                  placeholder={
                    isEditMode
                      ? t('upload.updateNotesEditPlaceholder')
                      : t('upload.updateNotesCreatePlaceholder')
                  }
                  className="rounded-xl border border-slate-200 bg-white p-4 focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            </div>

            <div className="w-full rounded-2xl border border-primary/20 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
              <h4 className="text-sm font-black uppercase tracking-wider text-primary">{t('upload.submissionSummary')}</h4>
              <div className="mt-3 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('upload.lesson')}</p>
                  <p className="mt-1 font-semibold text-slate-700 dark:text-slate-100">{form.title.trim() || t('upload.untitledLesson')}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('upload.audience')}</p>
                  <p className="mt-1 font-semibold text-slate-700 dark:text-slate-100">
                    {form.subject} • {form.gradeLevel}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('upload.delivery')}</p>
                  <p className="mt-1 font-semibold text-slate-700 dark:text-slate-100">
                    {form.format} • {summaryFileSize !== null ? `${summaryFileSize}MB` : t('upload.fileSizePending')}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('upload.pricingVisibility')}</p>
                  <p className="mt-1 font-semibold text-slate-700 dark:text-slate-100">
                    {summaryPriceLabel} • {summaryVisibilityLabel}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('upload.attachmentSummary')}</p>
                  <p className="mt-1 line-clamp-2 font-medium text-slate-700 dark:text-slate-100">
                    {form.attachmentSummary.trim() || t('upload.attachmentDetailsPending')}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('upload.tagsLabel')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {summaryTags.length > 0 ? (
                      summaryTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-primary/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-primary dark:bg-slate-900"
                        >
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs font-medium text-slate-500">{t('upload.noTagsYet')}</span>
                    )}
                  </div>
                </div>
                {summaryKeyLearnings.length > 0 ? (
                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('upload.keyLearningsLabel')}</p>
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {summaryKeyLearnings.join(' • ')}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.publishNow}
                onChange={(event) => setField('publishNow', event.target.checked)}
                className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              {t('upload.publishImmediately')}
            </label>
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-10">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1 || saving}
            className={`flex items-center gap-2 font-bold transition-all ${
              step === 1 || saving
                ? 'cursor-not-allowed text-slate-300'
                : 'text-slate-500 hover:text-primary'
            }`}
          >
            <ChevronLeft size={20} /> {t('upload.back')}
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-2 rounded-xl bg-primary px-10 py-3 font-bold text-white shadow-lg transition-all hover:bg-primary-hover"
            >
              {t('upload.nextStep')} <ChevronRight size={20} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canAdvance || saving}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-10 py-3 font-bold text-white shadow-lg transition-all hover:bg-emerald-600 disabled:opacity-70"
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
              {submitLabel}
            </button>
          )}
        </div>
      </div>
    </form>
  );
};
