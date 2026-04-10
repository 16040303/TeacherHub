import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-8">
      <div className="relative">
        <h1 className="text-[12rem] font-black text-slate-100 dark:text-slate-900 leading-none">404</h1>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-32 bg-primary/10 rounded-full blur-3xl" />
          <h2 className="text-4xl font-black tracking-tight relative z-10">Page Not Found</h2>
        </div>
      </div>
      
      <p className="text-slate-500 max-w-md mx-auto font-medium">
        Oops! The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      
      <div className="flex gap-4">
        <Link to="/" className="bg-primary text-white h-14 px-8 rounded-2xl font-bold shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all flex items-center gap-2">
          <Home size={20} /> Back Home
        </Link>
        <Link to="/library" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-14 px-8 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2">
          <Search size={20} /> Browse Library
        </Link>
      </div>
    </div>
  );
};
