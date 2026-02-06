import PropTypes from 'prop-types';
import { FiSearch } from 'react-icons/fi';

const InputField = ({
  value,
  onChange,
  onKeyDown,
  placeholder = "Ask me anything...",
  disabled = false,
  inputRef,
  icon: Icon = FiSearch // Renomeado para Icon (PascalCase) para usar como componente
}) => {
  return (
    <div className="relative flex items-center">
      {Icon && (
        <div className="absolute left-3 flex items-center justify-center w-4 h-4 text-gray-400 pointer-events-none">
          <Icon className="w-full h-full" />
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-32 py-3 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none font-light`}
        style={{ WebkitAppRegion: 'no-drag' }}
      />
    </div>
  );
};

InputField.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  inputRef: PropTypes.object,
  icon: PropTypes.elementType // Aceita um componente React
};

export default InputField;