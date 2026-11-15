// src/components/Avatar.jsx
// Circular avatar that falls back to initials when no image is given

export default function Avatar({ name = '?', emoji, size = 'md', className = '' }) {
  const sizes = {
    xs:  'w-7 h-7 text-sm',
    sm:  'w-9 h-9 text-base',
    md:  'w-12 h-12 text-xl',
    lg:  'w-16 h-16 text-2xl',
    xl:  'w-24 h-24 text-4xl',
  };
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div
      aria-label={name}
      className={`
        ${sizes[size] || sizes.md}
        rounded-full flex items-center justify-center
        bg-gradient-to-br from-violet-600 to-purple-900
        border-2 border-violet-400/50 font-bold text-white
        select-none shrink-0
        ${className}
      `}
    >
      {emoji || initials}
    </div>
  );
}

