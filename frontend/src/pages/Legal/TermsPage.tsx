import React from 'react';
import { BookOpenCheck, Mail } from 'lucide-react';

const LAST_UPDATED = 'March 16, 2026';

export const TermsPage: React.FC = () => {
  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-16">
      <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
          <BookOpenCheck size={14} /> Legal
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          These terms govern use of TeacherHub, including the community forum, digital lesson
          marketplace, and wallet-based transactions.
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black tracking-tight">1. Eligibility and Accounts</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          You are responsible for account credentials, profile accuracy, and all activity performed
          through your account. Admin privileges may be revoked for misuse.
        </p>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black tracking-tight">2. Educational Content</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Creators retain ownership of original resources they upload. By publishing on TeacherHub,
          you grant the platform a license to host, display, and distribute the resource to permitted
          purchasers under marketplace rules.
        </p>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black tracking-tight">3. Payments, Wallet, and Refunds</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <li>Lesson purchases are processed in platform coins through your TeacherHub wallet.</li>
          <li>Pending or failed orders can be retried once sufficient balance is available.</li>
          <li>Withdrawals are reviewed and may remain pending before completion.</li>
          <li>Refunds may be granted for duplicate charges or inaccessible paid content.</li>
        </ul>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black tracking-tight">4. Community Conduct</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Harassment, hate speech, spam, and unauthorized redistribution of paid resources are
          prohibited. Violations can result in content removal, suspension, or account termination.
        </p>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black tracking-tight">5. Service Availability</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          We aim for reliable uptime but do not guarantee uninterrupted access. Features may be updated,
          improved, or deprecated to maintain platform quality and security.
        </p>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black tracking-tight">6. Changes to Terms</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Material updates to these terms may be announced in-app. Continued use of TeacherHub after
          updates means you accept the revised terms.
        </p>
      </section>

      <section className="rounded-3xl border border-primary/20 bg-primary/5 p-8">
        <h2 className="text-xl font-black tracking-tight">Questions About These Terms?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          Contact us for legal inquiries or account policy questions.
        </p>
        <a
          href="mailto:legal@teacherhub.example"
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
        >
          <Mail size={16} /> legal@teacherhub.example
        </a>
      </section>
    </article>
  );
};
