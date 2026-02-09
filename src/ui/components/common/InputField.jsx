import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';
import { FiSearch } from 'react-icons/fi';

const InputField = ({
  value,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  placeholder = "Ask me anything...",
  disabled = false,
  inputRef,
  icon: Icon = FiSearch,
  maxHeight = 160
}) => {
  const internalRef = useRef(null);
  const mergedRef = inputRef || internalRef;

  useEffect(() => {
    if (!mergedRef?.current) return;
    const el = mergedRef.current;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
  }, [value, maxHeight, mergedRef]);

  return (
    <div className="relative flex items-center">
      {Icon && (
        <div className="absolute left-3 flex items-center justify-center w-4 h-4 text-gray-400 pointer-events-none">
          <Icon className="w-full h-full" />
        </div>
      )}
      <textarea
        ref={mergedRef}
        rows={1}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-3 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none font-light resize-none overflow-y-auto`}
        style={{ WebkitAppRegion: 'no-drag', maxHeight: `${maxHeight}px` }}
      />
    </div>
  );
};

InputField.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  inputRef: PropTypes.object,
  icon: PropTypes.elementType,
  maxHeight: PropTypes.number
};

export default InputField;
