import PropTypes from 'prop-types';
import StatusIndicator from '../common/StatusIndicator';

const Header = ({ isProcessing = false, interactionCount = 0 }) => {
  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-b border-white border-opacity-5"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-2">
        <StatusIndicator isActive={isProcessing} />
        <span className="text-xs font-medium text-gray-300 tracking-wide">
          NEXUS
        </span>
      </div>
      <div className="text-xs text-gray-400 font-mono">
        {interactionCount}
      </div>
    </div>
  );
};

Header.propTypes = {
  isProcessing: PropTypes.bool,
  interactionCount: PropTypes.number
};

export default Header;