import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  lightText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showSubtitle = true,
  lightText = false 
}) => {
  const iconSizes = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-10 h-10 rounded-2xl',
    lg: 'w-14 h-14 rounded-2xl',
    xl: 'w-20 h-20 rounded-3xl',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-3xl',
  };

  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className={`overflow-hidden shadow-md shrink-0 border border-indigo-100 ${iconSizes[size]}`}>
        <img
          src="/logo.png"
          alt="UniFood Logo"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex flex-col">
        <div className={`font-black tracking-tight leading-none ${textSizes[size]}`}>
          <span className={lightText ? 'text-white' : 'text-indigo-950'}>Uni</span>
          <span className="text-amber-500">Food</span>
        </div>
        {showSubtitle && (
          <span className={`text-[10px] font-bold mt-0.5 leading-tight ${lightText ? 'text-indigo-200' : 'text-slate-400'}`}>
            لوحة تحكم فروع المطاعم
          </span>
        )}
      </div>
    </div>
  );
};
