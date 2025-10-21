interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function PageContainer({ children, maxWidth = 'md' }: PageContainerProps) {
  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-pink-50 flex items-center justify-center p-4 sm:p-6">
      <div className={`w-full ${widthClasses[maxWidth]}`}>
        {children}
      </div>
    </div>
  );
}

