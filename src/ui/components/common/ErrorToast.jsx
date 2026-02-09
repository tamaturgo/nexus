import PropTypes from 'prop-types';
import { FiAlertCircle, FiX } from 'react-icons/fi';

const ErrorToast = ({ message, onDismiss }) => {
  if (!message) return null;
  
  return (
    <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50
                    bg-red-500/20 border border-red-500/50 rounded-lg p-3
                    flex items-center gap-3 animate-in slide-in-from-top-2 max-w-md">
      <FiAlertCircle className="text-red-400 w-5 h-5 flex-shrink-0" />
      <p className="text-sm text-red-200 flex-1">{message}</p>
      <button 
        onClick={onDismiss}
        className="text-red-400 hover:text-red-300 transition-colors ml-2"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  );
};

ErrorToast.propTypes = {
  message: PropTypes.string,
  onDismiss: PropTypes.func.isRequired
};

export default ErrorToast;
