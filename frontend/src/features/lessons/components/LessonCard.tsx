import React, { useEffect, useMemo, useState } from 'react';
import { Star, Download, FileText, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Lesson } from '../../../types';
import { formatCoins, toDateLabel } from '../../../utils/format';

interface LessonCardProps {
  lesson: Lesson;
}

export const LessonCard: React.FC<LessonCardProps> = ({ lesson }) => {
  const safePrice = Number.isFinite(lesson.price) ? Math.max(0, Math.round(lesson.price)) : 0;
  const safeRating = Number.isFinite(lesson.rating)
    ? Math.max(0, Math.min(5, lesson.rating))
    : 0;
  const safeDownloads = Number.isFinite(lesson.downloads) ? Math.max(0, lesson.downloads) : 0;
  const safeReviewCount = Number.isFinite(lesson.reviewCount)
    ? Math.max(0, lesson.reviewCount)
    : 0;
  const safeTags = Array.isArray(lesson.tags)
    ? lesson.tags.map((tag) => tag.trim()).filter(Boolean)
    : [];

  const fallbackThumbnail = useMemo(
    () => `https://picsum.photos/seed/${encodeURIComponent(lesson.id || 'teacherhub-lesson')}/640/420`,
    [lesson.id],
  );

  const preferredThumbnail = lesson.thumbnail?.trim() || fallbackThumbnail;
  const [thumbnailSrc, setThumbnailSrc] = useState(preferredThumbnail);

  useEffect(() => {
    setThumbnailSrc(preferredThumbnail);
  }, [preferredThumbnail]);

  const handleThumbnailError = (): void => {
    if (thumbnailSrc !== fallbackThumbnail) {
      setThumbnailSrc(fallbackThumbnail);
    }
  };

  return (
    <Link
      to={`/lesson/${lesson.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-2xl hover:shadow-primary/10 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary"
    >
      <div className="relative aspect-4/3 overflow-hidden">
        <img
          src={thumbnailSrc}
          alt={lesson.title}
          onError={handleThumbnailError}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="rounded-lg bg-white/90 px-3 py-1 text-[10px] font-black tracking-widest text-primary uppercase backdrop-blur-md dark:bg-slate-900/90">
            {lesson.subject}
          </span>
          <span className="rounded-lg bg-primary px-3 py-1 text-[10px] font-black tracking-widest text-white uppercase">
            {lesson.gradeLevel}
          </span>
        </div>

        <div className="absolute bottom-4 right-4">
          <span
            className={`rounded-xl px-4 py-2 text-sm font-black shadow-lg ${
              safePrice <= 0
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white'
            }`}
          >
            {safePrice <= 0 ? 'FREE' : `${formatCoins(safePrice)} Coins`}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="space-y-2">
          <h3 className="line-clamp-2 text-lg leading-tight font-bold transition-colors group-hover:text-primary">
            {lesson.title}
          </h3>
          <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{lesson.description}</p>
          <p className="text-xs font-medium text-slate-400">Updated {toDateLabel(lesson.updatedAt)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {safeTags.slice(0, 2).map((tag) => (
            <span
              key={`${lesson.id}-${tag}`}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-300"
            >
              {tag}
            </span>
          ))}
          {safeTags.length > 2 ? (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              +{safeTags.length - 2} tags
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
              <Star size={14} className="fill-yellow-500 text-yellow-500" />
              {safeRating.toFixed(1)}
              <span className="text-[11px] font-medium text-slate-400">({safeReviewCount})</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
              <Download size={14} />
              {formatCoins(safeDownloads)}
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            <FileText size={14} /> {lesson.format}
          </div>
        </div>

        <div className="inline-flex items-center gap-2 text-sm font-bold text-primary transition-transform group-hover:translate-x-1">
          <Sparkles size={15} /> View lesson plan
        </div>
      </div>
    </Link>
  );
};
