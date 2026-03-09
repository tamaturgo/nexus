import PropTypes from 'prop-types';
import StatusIndicator from '../common/StatusIndicator';
import { startWindowDrag } from '../../../infra/ipc/electronBridge.js';

const Header = ({ isProcessing = false, interactionCount = 0 }) => {
  const handleMouseDown = (event) => {
    if (event.button !== 0) return;
    startWindowDrag();
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-b border-white border-opacity-5"
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-2">
        <StatusIndicator isActive={isProcessing} />
        <span className="text-xs font-medium text-gray-300 tracking-wide">
          RECALLY
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
