import PropTypes from 'prop-types';

const ActionButton = ({
  onClick,
  disabled = false,
  title,
  children,
  variant = 'default',
  size = 'default',
  className = ''
}) => {
  const baseClasses = "transition-all duration-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = {
    default: "text-gray-400 hover:text-white hover:bg-white hover:bg-opacity-10",
    primary: "bg-blue-500 hover:bg-blue-600 text-white",
    danger: "text-red-400 hover:text-red-300 hover:bg-red-500 hover:bg-opacity-10"
  };

  const sizeClasses = {
    small: "p-1.5",
    default: "p-2",
    large: "p-3"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
};

ActionButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  title: PropTypes.string,
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['default', 'primary', 'danger']),
  size: PropTypes.oneOf(['small', 'default', 'large']),
  className: PropTypes.string
};

export default ActionButton;
