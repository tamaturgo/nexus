import PropTypes from 'prop-types';

const MainContainer = ({ children, isFocused, variant = 'overlay' }) => {
  if (variant === 'window') {
    return (
      <div className="w-full h-full bg-[#0b0c10] text-gray-100 overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-start p-2 animate-in fade-in zoom-in duration-300">
      <div className="w-full max-w-4xl">
        <div 
          className={`bg-black ${isFocused ? 'bg-opacity-95 neon-box-shadow' : 'bg-opacity-80'} backdrop-blur-2xl rounded-2xl border border-white border-opacity-10 shadow-2xl overflow-hidden transition-all duration-300 ease-in-out`}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

MainContainer.propTypes = {
  children: PropTypes.node.isRequired,
  isFocused: PropTypes.bool,
  variant: PropTypes.oneOf(['overlay', 'window'])
};

export default MainContainer;
