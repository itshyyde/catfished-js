interface InputProps {
  id?: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  maxLength?: number;
  required?: boolean;
  className?: string;
}

export function Input({ 
  id,
  type = 'text',
  value, 
  onChange, 
  placeholder, 
  label,
  maxLength,
  required = false,
  className = ''
}: InputProps) {
  return (
    <div>
      {label && (
        <label 
          htmlFor={id} 
          className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className={`w-full px-4 py-3 text-lg font-medium border-2 border-gray-200 rounded-xl focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 ${className}`}
        style={{ color: 'black' }}
      />
    </div>
  );
}

