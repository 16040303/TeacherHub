import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../../components/Header/Header';
import { Footer } from '../../components/Footer/Footer';

export const MainLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-primary selection:text-white">
      <Header />
      <main className="max-w-7xl mx-auto px-6 md:px-10 py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
