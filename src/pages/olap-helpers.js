export function formatCurrencyUSD(number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number(number) || 0);
}

export function formatNumber(number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(number) || 0);
}

export function formatAxisCurrency(value) {
  const numeric = Number(value) || 0;
  if (Math.abs(numeric) >= 1_000_000) {
    return `$${(numeric / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(numeric) >= 1_000) {
    return `$${(numeric / 1_000).toFixed(1)}K`;
  }
  return `$${Math.round(numeric)}`;
}

export function getStaticQuarterOptions() {
  return [1, 2, 3, 4].map((value) => ({
    value: String(value),
    label: `Q${value}`
  }));
}

export function getStaticMonthOptions() {
  return Array.from({ length: 12 }, (_, idx) => {
    const value = String(idx + 1);
    return { value, label: `M${value}` };
  });
}

export function buildTimeLabel(levelKey, year, quarter, month) {
  if (levelKey === "TG.Year") {
    return year ? String(year) : "Unknown";
  }

  if (levelKey === "TG.Quarter") {
    return quarter && year ? `Q${quarter} ${year}` : "Unknown";
  }

  return month && year ? `M${month} ${year}` : "Unknown";
}

export function buildTimeSeriesByLevel(
  rows,
  {
    level,
    getYear,
    getQuarter,
    getMonth,
    getValue,
    fillMissingBuckets = false
  }
) {
  const map = new Map();
  const bucketSet = new Set();
  const isYearLevel = level === "TG.Year" || level === 0;
  const isQuarterLevel = level === "TG.Quarter" || level === 1;

  rows.forEach((row) => {
    const yearNumeric = Number(getYear(row));
    if (!Number.isFinite(yearNumeric) || yearNumeric <= 0) {
      return;
    }

    const year = String(Math.trunc(yearNumeric));
    if (!map.has(year)) {
      map.set(year, new Map());
    }

    let bucket = "";
    if (isYearLevel) {
      bucket = year;
    } else if (isQuarterLevel) {
      const quarterNumeric = Number(getQuarter(row));
      if (!Number.isFinite(quarterNumeric) || quarterNumeric < 1 || quarterNumeric > 4) {
        return;
      }
      bucket = `Q${Math.trunc(quarterNumeric)}`;
    } else {
      const monthNumeric = Number(getMonth(row));
      if (!Number.isFinite(monthNumeric) || monthNumeric < 1 || monthNumeric > 12) {
        return;
      }
      bucket = `M${Math.trunc(monthNumeric)}`;
    }

    const yearMap = map.get(year);
    yearMap.set(bucket, (yearMap.get(bucket) || 0) + (Number(getValue(row)) || 0));
    if (!isYearLevel) {
      bucketSet.add(bucket);
    }
  });

  const years = [...map.keys()].sort((a, b) => Number(a) - Number(b));
  const buckets = isYearLevel
    ? years
    : isQuarterLevel
      ? (fillMissingBuckets
        ? ["Q1", "Q2", "Q3", "Q4"]
        : [...bucketSet].sort((a, b) => (Number(a.slice(1)) || 0) - (Number(b.slice(1)) || 0)))
      : (fillMissingBuckets
        ? Array.from({ length: 12 }, (_, idx) => `M${idx + 1}`)
        : [...bucketSet].sort((a, b) => (Number(a.slice(1)) || 0) - (Number(b.slice(1)) || 0)));

  if (isYearLevel) {
    return {
      mode: "year",
      years,
      buckets,
      seriesByYear: years.map((year) => ({ year, values: [map.get(year)?.get(year) || 0] }))
    };
  }

  return {
    mode: "bucket",
    years,
    buckets,
    seriesByYear: years.map((year) => ({
      year,
      values: buckets.map((bucket) => map.get(year)?.get(bucket) || 0)
    }))
  };
}

export function truncateMiddle(value, maxLength = 18, head = 6, tail = 4) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

export function toNumeric(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function isInRange(value, min, max) {
  const minNumber = min === "" || min === null || min === undefined ? null : Number(min);
  const maxNumber = max === "" || max === null || max === undefined ? null : Number(max);
  const candidate = Number(value) || 0;

  if (minNumber !== null && candidate < minNumber) {
    return false;
  }

  if (maxNumber !== null && candidate > maxNumber) {
    return false;
  }

  return true;
}

export function getLatestMember(options) {
  if (!Array.isArray(options) || options.length === 0) {
    return "";
  }

  const withNumeric = options
    .map((option) => ({
      raw: String(option.value),
      numeric: toNumeric(option.value)
    }))
    .filter((item) => item.raw !== "");

  if (withNumeric.length === 0) {
    return String(options[options.length - 1].value);
  }

  withNumeric.sort((a, b) => {
    if (a.numeric !== null && b.numeric !== null) {
      return a.numeric - b.numeric;
    }
    return a.raw.localeCompare(b.raw, undefined, { numeric: true, sensitivity: "base" });
  });

  return withNumeric[withNumeric.length - 1].raw;
}

export function quarterOfMonth(monthValue) {
  const numeric = toNumeric(monthValue);
  if (!numeric || numeric < 1 || numeric > 12) {
    return null;
  }
  return Math.ceil(numeric / 3);
}

export function sortDimensionLabel(a, b) {
  const aNumeric = toNumeric(a);
  const bNumeric = toNumeric(b);

  if (aNumeric !== null && bNumeric !== null) {
    return aNumeric - bNumeric;
  }

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function buildMatrixRows(items, pivot, firstColumnLabel, secondColumnLabel, valueFormatter) {
  const formatter = valueFormatter || ((value) => value);

  if (!pivot) {
    return {
      headers: [firstColumnLabel, secondColumnLabel],
      rows: items.map((item) => [item.label, formatter(item.value)])
    };
  }

  return {
    headers: [secondColumnLabel, ...items.map((item) => item.label)],
    rows: [[secondColumnLabel, ...items.map((item) => formatter(item.value))]]
  };
}

export function resolveCubeName(factGroup, selectedDimensions, activeFilters = {}) {
  const dims = Array.isArray(selectedDimensions) ? selectedDimensions.map((d) => d.toUpperCase()) : [];
  const hasMH = dims.includes("MH");
  const hasCH = dims.includes("CH");
  const hasKH = dims.includes("KH");
  // Kiểm tra nếu có bộ lọc thời gian đang được áp dụng ở thanh công cụ
  const hasActiveTimeFilter = (activeFilters.years?.length > 0) || (activeFilters.quarters?.length > 0) || (activeFilters.months?.length > 0);
  const hasTG = dims.includes("TG") || hasActiveTimeFilter;

  // 1. Nhóm Mat_Hang
  if (factGroup === "Fact_BanHang" || factGroup === "BanHang") {
    if (hasMH && hasTG) return "BanHang_MH_TG";
    if (hasMH) return "BanHang_MH";
    if (hasTG) return "BanHang_TG";
    return "BanHang_MH_TG";
  }

  // 2. Nhóm Ton_Kho
  if (factGroup === "Fact_TonKho" || factGroup === "TonKho") {
    if (hasCH && hasMH && hasTG) return "TonKho";
    if (hasCH && hasMH) return "TonKho_CH_MH";
    if (hasCH && hasTG) return "TonKho_CH_TG";
    if (hasCH) return "TonKho_CH";
    // Server không có TonKho_MH_TG, dùng TonKho làm fallback
    if (hasMH && hasTG) return "TonKho";
    if (hasMH) return "TonKho_MH";
    // Server không có TonKho_TG, dùng TonKho làm fallback
    if (hasTG) return "TonKho";
    return "TonKho";
  }

  // 3. Nhóm Hanh_vi
  if (factGroup === "Fact_HanhVi" || factGroup === "HanhVi") {
    // Server không có khối tổng hợp, ưu tiên dùng khối KH
    if (hasKH) return "HanhVi_KH";
    if (hasTG) return "HanhVi_TG";
    return "HanhVi_KH";
  }

  return "";
}
