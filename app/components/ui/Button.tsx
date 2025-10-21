interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export function Button({ 
  children, 
  onClick, 
  disabled = false, 
  variant = 'primary',
  className = '' 
}: ButtonProps) {
  const baseStyles = "w-full py-4 px-6 text-lg font-bold rounded-full shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";
  
  const variantStyles = variant === 'primary'
    ? "text-white bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
    : "text-gray-800 bg-gray-100 hover:bg-gray-200";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      {children}
    </button>
  );
}

