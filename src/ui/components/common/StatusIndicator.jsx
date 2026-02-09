import PropTypes from 'prop-types';

const StatusIndicator = ({ isActive = false, size = 'default' }) => {
  const sizeClasses = {
    small: "w-1.5 h-1.5",
    default: "w-2 h-2",
    large: "w-3 h-3"
  };

  return (
    <div className={`rounded-full transition-all duration-300 ${
      isActive
        ? 'shadow-lg shadow-purple-400/50 neon-pulse'
        : ''
    } ${sizeClasses[size]}`} />
  );
};

StatusIndicator.propTypes = {
  isActive: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'default', 'large'])
};

export default StatusIndicator;