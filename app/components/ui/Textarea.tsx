interface TextareaProps {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
  required?: boolean;
  className?: string;
}

export function Textarea({ 
  id,
  value, 
  onChange, 
  placeholder, 
  label,
  rows = 4,
  required = false,
  className = ''
}: TextareaProps) {
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
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className={`w-full px-4 py-3 text-base text-gray-800 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 resize-none ${className}`}
        style={{ color: 'black' }}
      />
    </div>
  );
}

