import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Trash2, UploadCloud } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { profileService } from '../../services/profileService';
import { useToast } from '../../app/providers/ToastProvider';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { useLanguage } from '../../app/providers/LanguageProvider';

interface ProfileForm {
  name: string;
  subject: string;
  experience: string;
  location: string;
  bio: string;
  avatar: string;
}

const emptyForm: ProfileForm = {
  name: '',
  subject: '',
  experience: '',
  location: '',
  bio: '',
  avatar: '',
};

const MAX_AVATAR_FILE_MB = 2;
const MAX_AVATAR_FILE_BYTES = MAX_AVATAR_FILE_MB * 1024 * 1024;

const SUPPORTED_AVATAR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const SUPPORTED_AVATAR_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const toInitials = (value: string): string => {
  const parts = value
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'TH';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'TH';
};

const isSupportedAvatarFile = (file: File): boolean => {
  const mime = file.type.toLowerCase();
  if (mime && SUPPORTED_AVATAR_MIME_TYPES.has(mime)) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return SUPPORTED_AVATAR_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
};

const fileToDataUrl = async (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string' || !result.startsWith('data:image/')) {
        reject(new Error('Unsupported image format'));
        return;
      }

      resolve(result);
    };

    reader.onerror = () => reject(new Error('Unable to read selected image'));

    reader.readAsDataURL(file);
  });

export const ProfilePage: React.FC = () => {
  const { user, refreshSession } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [processingAvatar, setProcessingAvatar] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [savedAvatar, setSavedAvatar] = useState('');
  const [form, setForm] = useState<ProfileForm>(emptyForm);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      if (!user) {
        setLoading(false);
        setLoadError(t('profile.loginRequired'));
        return;
      }

      setLoading(true);
      setLoadError(null);
      try {
        const profile = await profileService.getCurrentUserProfile(user.id);
        if (!active || !profile) {
          return;
        }

        const initialAvatar = profile.avatar?.trim() ?? '';

        setForm({
          name: profile.name,
          subject: profile.subject ?? '',
          experience: profile.experience ?? '',
          location: profile.location ?? '',
          bio: profile.bio ?? '',
          avatar: initialAvatar,
        });
        setSavedAvatar(initialAvatar);
        setAvatarFeedback(null);
        setAvatarError(null);
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : t('profile.unableToLoadProfile');
          setLoadError(message);
          showToast({ type: 'error', message });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [loadAttempt, showToast, user]);

  const updateField = (key: keyof ProfileForm, value: string): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetAvatarInput = (): void => {
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setAvatarError(null);
    setAvatarFeedback(null);

    if (!isSupportedAvatarFile(selectedFile)) {
      setAvatarError(t('profile.unsupportedFileType'));
      showToast({ type: 'error', message: t('profile.unsupportedFileType') });
      resetAvatarInput();
      return;
    }

    if (selectedFile.size <= 0) {
      setAvatarError(t('profile.emptyImage'));
      showToast({ type: 'error', message: t('profile.emptyImage') });
      resetAvatarInput();
      return;
    }

    if (selectedFile.size > MAX_AVATAR_FILE_BYTES) {
      setAvatarError(t('profile.fileTooLarge', { size: MAX_AVATAR_FILE_MB }));
      showToast({ type: 'error', message: t('profile.fileTooLarge', { size: MAX_AVATAR_FILE_MB }) });
      resetAvatarInput();
      return;
    }

    setProcessingAvatar(true);

    try {
      const avatarDataUrl = await fileToDataUrl(selectedFile);

      setForm((current) => ({ ...current, avatar: avatarDataUrl }));
      setAvatarFeedback(t('toast.photoPreviewSaved', { name: selectedFile.name }));
      showToast({ type: 'success', message: t('toast.photoSelected') });
    } catch {
      setAvatarError(t('profile.unableToProcessImage'));
      showToast({ type: 'error', message: t('profile.cannotReadImage') });
    } finally {
      setProcessingAvatar(false);
      resetAvatarInput();
    }
  };

  const handleRemoveAvatar = (): void => {
    if (!form.avatar.trim()) {
      return;
    }

    setForm((current) => ({ ...current, avatar: '' }));
    setAvatarError(null);
    setAvatarFeedback(t('profile.avatarRemovalPending'));
    showToast({ type: 'info', message: t('toast.avatarRemovalPending') });
    resetAvatarInput();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!user || saving || processingAvatar) {
      return;
    }

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      showToast({ type: 'error', message: t('profile.nameRequired') });
      return;
    }

    const normalizedForm: ProfileForm = {
      name: trimmedName,
      subject: form.subject.trim(),
      experience: form.experience.trim(),
      location: form.location.trim(),
      bio: form.bio.trim(),
      avatar: form.avatar.trim(),
    };

    const avatarChanged = normalizedForm.avatar !== savedAvatar;

    setSaving(true);
    try {
      await profileService.updateCurrentUserProfile(user.id, normalizedForm);
      await refreshSession();

      setForm(normalizedForm);
      setSavedAvatar(normalizedForm.avatar);
      setAvatarError(null);
      setAvatarFeedback(
        avatarChanged
          ? normalizedForm.avatar
            ? t('toast.profilePhotoUpdated')
            : t('toast.profilePhotoRemoved')
          : null,
      );

      showToast({ type: 'success', message: t('toast.profileUpdated') });
    } catch (error) {
      setForm((current) => ({ ...current, avatar: savedAvatar }));
      setAvatarFeedback(null);
      setAvatarError(t('profile.avatarRemovalError'));

      const message = error instanceof Error ? error.message : t('profile.updateError');
      showToast({ type: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = form.avatar.trim();
  const avatarInitials = useMemo(() => toInitials(form.name || user?.name || t('app.name')), [form.name, user?.name, t]);
  const hasPendingAvatarChange = avatarSrc !== savedAvatar;

  if (loading) {
    return <LoadingState title={t('profile.loading')} description={t('profile.loadingDescription')} />;
  }

  if (loadError) {
    return (
      <EmptyState
        title={t('profile.loadError')}
        description={loadError}
        action={
          <button
            type="button"
            onClick={() => {
              setLoadAttempt((current) => current + 1);
            }}
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            {t('common.retry')}
          </button>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-14">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{t('profile.title')}</h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {t('profile.subtitle')}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative size-24 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Profile avatar preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-black text-slate-500 dark:text-slate-300">
                  {avatarInitials}
                </div>
              )}

              {processingAvatar ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              ) : null}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-bold">{t('profile.profilePhoto')}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('profile.uploadPhotoHint', { size: MAX_AVATAR_FILE_MB })}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={processingAvatar || saving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                >
                  <UploadCloud size={16} />
                  {avatarSrc ? t('profile.changePhoto') : t('profile.uploadPhoto')}
                </button>

                {avatarSrc ? (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={processingAvatar || saving}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    <Trash2 size={16} /> {t('profile.removePhoto')}
                  </button>
                ) : null}

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    void handleAvatarFileChange(event);
                  }}
                />
              </div>

              {hasPendingAvatarChange ? (
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                  {t('profile.avatarChangeReady')}
                </p>
              ) : null}

              <div aria-live="polite" className="text-xs font-semibold">
                {avatarError ? (
                  <p className="text-rose-600 dark:text-rose-300">{avatarError}</p>
                ) : avatarFeedback ? (
                  <p className="text-slate-500 dark:text-slate-400">{avatarFeedback}</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold">
            <span>{t('profile.name')}</span>
            <input
              required
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>{t('profile.subject')}</span>
            <input
              value={form.subject}
              onChange={(event) => updateField('subject', event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>{t('profile.experience')}</span>
            <input
              value={form.experience}
              onChange={(event) => updateField('experience', event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>{t('profile.location')}</span>
            <input
              value={form.location}
              onChange={(event) => updateField('location', event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        </div>

        <label className="space-y-2 text-sm font-semibold">
          <span>{t('profile.bio')}</span>
          <textarea
            rows={5}
            value={form.bio}
            onChange={(event) => updateField('bio', event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

        <button
          type="submit"
          disabled={saving || processingAvatar}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover disabled:opacity-60"
        >
          {saving ? t('profile.saving') : t('profile.saveProfile')}
        </button>
      </form>
    </div>
  );
};
