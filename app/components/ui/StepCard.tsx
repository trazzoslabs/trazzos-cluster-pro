import React from 'react';

interface StepCardProps {
  stepNumber: number;
  title: string;
  description: string;
  isActive?: boolean;
  isCompleted?: boolean;
  children: React.ReactNode;
}

const StepCard: React.FC<StepCardProps> = ({ 
  stepNumber, 
  title, 
  description, 
  isActive = false, 
  isCompleted = false,
  children 
}) => {
  return (
    <div className={`card mb-6 ${isActive ? 'border-[#9aff8d]/40 bg-[#141414]' : ''} ${isCompleted ? 'border-green-500/20' : ''}`}>
      <div className="flex items-start gap-4 mb-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
          isCompleted 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : isActive 
            ? 'bg-[#9aff8d]/20 text-[#9aff8d] border border-[#9aff8d]/30' 
            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
        }`}>
          {isCompleted ? '✓' : stepNumber}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-white mb-1">{title}</h3>
          <p className="text-sm text-zinc-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
};

export default StepCard;





