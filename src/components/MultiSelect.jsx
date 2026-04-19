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
  placeholder = "All",
  searchable = true
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
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

  const isAllSelected = !values || values.length === 0;

  const selected = useMemo(() => {
    if (isAllSelected) {
      return new Set();
    }
    return toSet(values);
  }, [isAllSelected, values]);

  const triggerLabel = useMemo(() => {
    if (!values || values.length === 0) {
      return placeholder;
    }
    if (values.length === 1) {
      return options.find((item) => item.value === values[0])?.label ?? placeholder;
    }
    return `${values.length} selected`;
  }, [options, placeholder, values]);

  const visibleOptions = useMemo(() => {
    if (!searchable) {
      return options;
    }

    const keyword = searchText.trim().toLowerCase();
    if (!keyword) {
      return options;
    }

    return options.filter((item) => {
      const labelText = String(item.label ?? "").toLowerCase();
      const valueText = String(item.value ?? "").toLowerCase();
      return labelText.includes(keyword) || valueText.includes(keyword);
    });
  }, [options, searchable, searchText]);

  useEffect(() => {
    if (!isOpen) {
      setSearchText("");
    }
  }, [isOpen]);

  function toggleValue(value) {
    if (isAllSelected) {
      onChange([value]);
      return;
    }

    const nextSet = new Set(selected);
    if (nextSet.has(value)) {
      nextSet.delete(value);
    } else {
      nextSet.add(value);
    }

    if (nextSet.size === 0) {
      onChange([]);
      return;
    }

    onChange([...nextSet]);
  }

  function selectAll() {
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
          {searchable ? (
            <div className="multi-select__search-wrap">
              <input
                type="text"
                className="multi-select__search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Type to search..."
              />
            </div>
          ) : null}
          <label className="multi-select__all">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={selectAll}
            />
            <span>All</span>
          </label>
          <ul>
            {visibleOptions.map((option) => (
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
            {visibleOptions.length === 0 ? (
              <li className="multi-select__empty">No matching option.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
