
import React from 'react';

interface LoadingSpinnerProps {
    message: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => {
    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-70 flex flex-col items-center justify-center z-50">
            <div className="w-16 h-16 border-4 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-white text-lg font-semibold">{message}</p>
        </div>
    );
};

export default LoadingSpinner;
