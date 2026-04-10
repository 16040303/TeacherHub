import React from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';

export const LessonFilters: React.FC = () => {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Search Resources</h3>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by topic, keyword..." 
            className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl h-14 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Filters</h3>
          <button className="text-xs font-bold text-primary hover:underline">Reset All</button>
        </div>

        <div className="flex flex-col gap-6">
          {/* Subject Filter */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</label>
            <div className="flex flex-wrap gap-2">
              {['Math', 'Science', 'English', 'History', 'Art'].map(subject => (
                <button key={subject} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold hover:border-primary hover:text-primary transition-all">
                  {subject}
                </button>
              ))}
            </div>
          </div>

          {/* Grade Level */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grade Level</label>
            <div className="flex flex-col gap-2">
              {['Elementary', 'Middle School', 'High School', 'University'].map(grade => (
                <label key={grade} className="flex items-center gap-3 cursor-pointer group">
                  <div className="size-5 rounded-md border-2 border-slate-200 dark:border-slate-800 group-hover:border-primary transition-all" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{grade}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Price Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button className="py-2.5 rounded-xl bg-primary text-white text-xs font-bold">All</button>
              <button className="py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold hover:border-primary transition-all">Free Only</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
