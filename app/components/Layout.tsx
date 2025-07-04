import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, className = '' }) => {
  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 ${className}`}>
      <main className="max-w-6xl mx-auto p-4 lg:p-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
