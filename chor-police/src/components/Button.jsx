// src/components/Button.jsx
import { motion } from 'framer-motion';

const variants = {
  primary:   'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/50',
  secondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/20',
  danger:    'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50',
  gold:      'bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-lg shadow-amber-900/50',
  ghost:     'bg-transparent hover:bg-white/10 text-white/70 hover:text-white',
};

const sizes = {
  sm:  'px-3 py-1.5 text-sm rounded-lg',
  md:  'px-5 py-2.5 text-base rounded-xl',
  lg:  'px-8 py-3.5 text-lg rounded-2xl',
  xl:  'px-10 py-4 text-xl rounded-2xl',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  icon: Icon,
  ...rest
}) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.03 }}
      whileTap={disabled   ? {} : { scale: 0.97 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-semibold
        transition-all duration-200 select-none cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed
        focus-visible:outline-2 focus-visible:outline-violet-400 focus-visible:outline-offset-2
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      {...rest}
    >
      {Icon && <Icon size={18} />}
      {children}
    </motion.button>
  );
}
