interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;
  
  return (
    <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
      <div className="text-red-700 font-medium text-center text-sm">{message}</div>
    </div>
  );
}

