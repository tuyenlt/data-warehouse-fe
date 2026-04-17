import { useEffect, useMemo, useRef, useState } from "react";
import "./multi-select.css";

function toSet(values) {
  return new Set(values ?? []);
}

export default function MultiSelect({
  label,
  values,
  options,
  onChange,
  placeholder = "All"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allValues = useMemo(() => options.map((item) => item.value), [options]);

  const selected = useMemo(() => {
    if (!values || values.length === 0) {
      return toSet(allValues);
    }
    return toSet(values);
  }, [allValues, values]);

  const triggerLabel = useMemo(() => {
    if (!values || values.length === 0) {
      return placeholder;
    }
    if (values.length === 1) {
      return options.find((item) => item.value === values[0])?.label ?? placeholder;
    }
    return `${values.length} selected`;
  }, [options, placeholder, values]);

  function toggleValue(value) {
    const nextSet = new Set(selected);
    if (nextSet.has(value)) {
      nextSet.delete(value);
    } else {
      nextSet.add(value);
    }

    if (nextSet.size === allValues.length) {
      onChange([]);
      return;
    }

    onChange([...nextSet]);
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="multi-select" ref={rootRef}>
      {label ? <p className="multi-select__label">{label}</p> : null}
      <button type="button" className="multi-select__trigger" onClick={() => setIsOpen((prev) => !prev)}>
        <span>{triggerLabel}</span>
        <span className="multi-select__caret">▾</span>
      </button>

      {isOpen ? (
        <div className="multi-select__menu" role="listbox" aria-label={label ?? "multi-filter"}>
          <button type="button" className="multi-select__clear" onClick={clearAll}>
            All
          </button>
          <ul>
            {options.map((option) => (
              <li key={option.value}>
                <label className="multi-select__option">
                  <input
                    type="checkbox"
                    checked={selected.has(option.value)}
                    onChange={() => toggleValue(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
