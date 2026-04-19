const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5096").replace(/\/$/, "");

const DIMENSION_TOKEN_ALIASES = {
  year: ["year", "nam"],
  quarter: ["quarter", "quy"],
  month: ["month", "thang"],
  city: ["city", "thanh pho", "thanhpho"],
  state: ["state", "bang", "tinh"],
  type: ["type", "loai khach hang", "loaikhachhang"],
  description: ["description", "mo ta", "mota"],
  storekey: ["storekey", "cua hang", "cuahang"],
  productkey: ["productkey", "mat hang", "mathang"],
  customerkey: ["customerkey", "khach hang", "khachhang"],
  firstorderdate: ["firstorderdate", "first order date", "ngay dat", "ngaydat"]
};

const MEASURE_TOKEN_ALIASES = {
  "sales.amount": ["sales.amount", "salesamount", "gia ban", "sotienbanra", "amount"],
  "sales.quantity": ["sales.quantity", "soluong", "so luong", "quantity"],
  "sales.profit": ["sales.profit", "profitamount", "loi nhuan", "sotienlai", "profit"],
  "sales.avgprofit": ["sales.avgprofit", "avgprofit", "loi nhuan tb", "solaitrungbinh"],
  "inventory.quantity": ["inventory.quantity", "soluongton", "so luong ton", "quantity"],
  "inventory.weight": ["inventory.weight", "trongluong", "trong luong", "weight"],
  "inventory.value": ["inventory.value", "giatri", "gia tri", "value"],
  "behavior.totalitems": ["behavior.totalitems", "totalitems", "somathang", "so mat hang", "items"],
  "behavior.totalrevenue": ["behavior.totalrevenue", "totalrevenue", "tongthu", "doanhthu", "doanh thu", "revenue"],
  "behavior.avgordervalue": ["behavior.avgordervalue", "avgordervalue", "gia tb", "average"]
};

function buildDimensionTokens(dimension) {
  const leaf = String(dimension || "")
    .split(".")
    .pop()
    ?.toLowerCase() || "";

  return DIMENSION_TOKEN_ALIASES[leaf] || [leaf];
}

function buildMeasureTokens(measureName) {
  const normalized = String(measureName || "").toLowerCase();
  return MEASURE_TOKEN_ALIASES[normalized] || [normalized];
}

function parseTemporalNumber(raw, min, max) {
  const text = String(raw || "").trim();
  const match = text.match(/\d{1,4}/);
  if (!match) {
    return null;
  }

  const value = Number(match[0]);
  if (!Number.isFinite(value) || value < min || value > max) {
    return null;
  }

  return value;
}

function normalizeDimensionMember(dimension, caption) {
  const text = String(caption || "").trim();
  if (!text) {
    return null;
  }

  if (dimension === "TG.Year") {
    const year = parseTemporalNumber(text, 1900, 3000);
    if (year !== null) {
      return { value: String(year), label: String(year) };
    }
  }

  if (dimension === "TG.Quarter") {
    const quarter = parseTemporalNumber(text, 1, 4);
    if (quarter !== null) {
      return { value: String(quarter), label: `Q${quarter}` };
    }
  }

  if (dimension === "TG.Month") {
    const month = parseTemporalNumber(text, 1, 12);
    if (month !== null) {
      return { value: String(month), label: `M${month}` };
    }
  }

  return { value: text, label: text };
}

function isMeasureKey(key) {
  return String(key || "").toLowerCase().includes("[measures]");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizeFactGroup(factGroup) {
  if (!factGroup) {
    return factGroup;
  }

  const aliases = {
    BanHang: "Fact_BanHang",
    TonKho: "Fact_TonKho",
    HanhVi: "Fact_HanhVi"
  };

  return aliases[factGroup] || factGroup;
}

function normalizeFilters(filters) {
  if (!filters) {
    return {};
  }

  if (Array.isArray(filters)) {
    return filters.reduce((acc, item) => {
      if (!item?.key) {
        return acc;
      }

      if (!Array.isArray(item.values)) {
        acc[item.key] = item.values;
        return acc;
      }

      const normalizedValues = item.values
        .map((value) => (typeof value === "string" ? value.trim() : value))
        .filter((value) => value !== "" && value !== null && value !== undefined);

      if (normalizedValues.length === 0) {
        return acc;
      }

      // Keep array shape for all multi-select filters so backend receives consistent input.
      acc[item.key] = normalizedValues;
      return acc;
    }, {});
  }

  return filters;
}

function normalizePayload(payload) {
  const {
    page,
    pageSize,
    pagination,
    factGroup,
    filters,
    measureRanges,
    ...rest
  } = payload || {};

  return {
    ...rest,
    factGroup: normalizeFactGroup(factGroup),
    filters: normalizeFilters(filters),
    measureRanges: measureRanges || {},
    pagination: pagination || {
      page: page || 1,
      pageSize: pageSize || 50
    },
    sorts: Array.isArray(rest.sorts) ? rest.sorts : []
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // Ignore JSON parse error and keep default message.
    }
    throw new Error(message);
  }

  return response.json();
}

export function queryOlap(payload) {
  return request("/api/olap/query", {
    method: "POST",
    body: JSON.stringify(normalizePayload(payload))
  });
}

const OLAP_ALL_PAGES_CACHE = new Map();
const OLAP_ALL_PAGES_INFLIGHT = new Map();
const MIN_ALL_PAGES_SIZE = 2000;
const MIN_ALL_PAGES_MAX = 2000;
const MAX_NO_PROGRESS_PAGES = 3;

function buildAllPagesCacheKey(payload, pageSize, maxPages) {
  const normalized = normalizePayload({
    ...payload,
    page: 1,
    pageSize
  });

  return JSON.stringify({ normalized, pageSize, maxPages });
}

function buildRowSignature(row) {
  if (!row || typeof row !== "object") {
    return String(row);
  }

  const orderedEntries = Object.entries(row).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(orderedEntries);
}

export async function queryOlapAllPages(
  payload,
  {
    pageSize = 1000,
    maxPages = 200,
    useCache = true,
    cacheTtlMs = 45_000
  } = {}
) {
  const effectiveRequestedPageSize = Math.max(Number(pageSize) || 0, MIN_ALL_PAGES_SIZE);
  const effectiveMaxPages = Math.max(Number(maxPages) || 0, MIN_ALL_PAGES_MAX);
  const cacheKey = buildAllPagesCacheKey(payload, effectiveRequestedPageSize, effectiveMaxPages);

  if (useCache) {
    const cached = OLAP_ALL_PAGES_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
      return cached.value;
    }

    const inFlight = OLAP_ALL_PAGES_INFLIGHT.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const promise = (async () => {
    const firstResponse = await queryOlap({
      ...payload,
      // Ask backend to bypass paging and return all rows in one response when possible.
      isChart: true,
      page: 1,
      pageSize: effectiveRequestedPageSize
    });

    const firstData = Array.isArray(firstResponse?.data) ? firstResponse.data : [];
    const totalRowsRaw = Number(firstResponse?.totalRows ?? firstResponse?.TotalRows);
    const hasTotalRows = Number.isFinite(totalRowsRaw) && totalRowsRaw >= 0;
    const effectivePageSize = Number(firstResponse?.pageSize ?? firstResponse?.PageSize) || firstData.length || effectiveRequestedPageSize;

    if (firstData.length === 0) {
      const emptyResult = {
        ...firstResponse,
        data: []
      };

      if (useCache) {
        OLAP_ALL_PAGES_CACHE.set(cacheKey, { timestamp: Date.now(), value: emptyResult });
      }

      return emptyResult;
    }

    const chartModeReturnedAllRows = firstResponse?.page == null
      && firstResponse?.pageSize == null
      && (!hasTotalRows || firstData.length >= totalRowsRaw);

    if (chartModeReturnedAllRows) {
      const singleResponseResult = {
        ...firstResponse,
        data: firstData,
        totalRows: hasTotalRows ? totalRowsRaw : firstData.length,
        page: 1,
        pageSize: firstData.length
      };

      if (useCache) {
        OLAP_ALL_PAGES_CACHE.set(cacheKey, { timestamp: Date.now(), value: singleResponseResult });
      }

      return singleResponseResult;
    }

    const allData = [...firstData];
    const seenSignatures = new Set(firstData.map((row) => buildRowSignature(row)));
    let page = 2;
    let noProgressPages = 0;

    while (page <= effectiveMaxPages) {
      if (hasTotalRows && allData.length >= totalRowsRaw) {
        break;
      }

      const pageResponse = await queryOlap({
        ...payload,
        page,
        pageSize: effectivePageSize
      });

      const pageData = Array.isArray(pageResponse?.data) ? pageResponse.data : [];
      if (pageData.length === 0) {
        break;
      }

      let insertedRows = 0;
      pageData.forEach((row) => {
        const signature = buildRowSignature(row);
        if (seenSignatures.has(signature)) {
          return;
        }

        seenSignatures.add(signature);
        allData.push(row);
        insertedRows += 1;
      });

      if (insertedRows === 0) {
        noProgressPages += 1;
        // Some cubes can yield repeated slices intermittently; allow a few retries before stopping.
        if (!hasTotalRows || noProgressPages >= MAX_NO_PROGRESS_PAGES) {
          break;
        }
      } else {
        noProgressPages = 0;
      }

      if (!hasTotalRows && pageData.length < effectivePageSize) {
        break;
      }

      if (hasTotalRows && allData.length >= totalRowsRaw) {
        break;
      }

      page += 1;
    }

    const result = {
      ...firstResponse,
      data: allData,
      totalRows: hasTotalRows ? totalRowsRaw : allData.length,
      page: 1,
      pageSize: allData.length
    };

    if (useCache) {
      OLAP_ALL_PAGES_CACHE.set(cacheKey, { timestamp: Date.now(), value: result });
    }

    return result;
  })();

  if (useCache) {
    OLAP_ALL_PAGES_INFLIGHT.set(cacheKey, promise);
  }

  try {
    return await promise;
  } finally {
    if (useCache) {
      OLAP_ALL_PAGES_INFLIGHT.delete(cacheKey);
    }
  }
}

export function clearOlapAllPagesCache() {
  OLAP_ALL_PAGES_CACHE.clear();
  OLAP_ALL_PAGES_INFLIGHT.clear();
}

export async function getMetadata() {
  return request("/api/olap/metadata");
}

export async function getDimensionMembers({
  factGroup,
  cube,
  dimension,
  measure,
  filters,
  pageSize = 1000,
  maxPages = 1000,
  useCache = true
}) {
  const response = await queryOlapAllPages({
    factGroup,
    cube,
    measures: [measure],
    rows: [dimension],
    columns: [],
    filters: filters || {},
    page: 1,
    pageSize
  }, {
    pageSize,
    maxPages,
    useCache,
    cacheTtlMs: 45_000
  });

  const uniqueValues = new Set();
  const normalizedOptions = new Map();
  const tokens = buildDimensionTokens(dimension);
  (response?.data || []).forEach((row) => {
    const caption = extractDimensionValue(row, tokens) || extractFirstCaption(row);
    if (!caption) {
      return;
    }

    const normalized = normalizeDimensionMember(dimension, caption);
    if (!normalized) {
      return;
    }

    uniqueValues.add(normalized.value);
    if (!normalizedOptions.has(normalized.value)) {
      normalizedOptions.set(normalized.value, normalized.label);
    }
  });

  return [...uniqueValues]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((value) => ({ value, label: normalizedOptions.get(value) || value }));
}

export function extractMeasureValues(row) {
  return Object.entries(row)
    .filter(([key]) => isMeasureKey(key))
    .map(([, value]) => Number(value) || 0);
}

export function extractFirstCaption(row) {
  const entry = Object.entries(row).find(([key]) => !isMeasureKey(key));
  return entry ? String(entry[1] ?? "") : "";
}

export function extractDimensionCaptions(row) {
  return Object.entries(row)
    .filter(([key]) => !isMeasureKey(key))
    .map(([key, value]) => ({ key, value: String(value ?? "") }));
}

export function extractDimensionValue(row, preferredTokens = []) {
  const dimensions = extractDimensionCaptions(row);
  if (dimensions.length === 0) {
    return "";
  }

  if (!preferredTokens.length) {
    return dimensions[0].value;
  }

  const matched = dimensions.find((item) => {
    const lowerKey = normalizeText(item.key);
    return preferredTokens.some((token) => lowerKey.includes(normalizeText(token)));
  });

  if (matched) {
    return matched.value;
  }

  // Only fallback to the first dimension when the row actually contains a single dimension.
  return dimensions.length === 1 ? dimensions[0].value : "";
}

export function extractDimensionsLabel(row, separator = " - ") {
  return extractDimensionCaptions(row)
    .map((item) => item.value)
    .filter(Boolean)
    .join(separator);
}

export function extractMeasureByName(row, measureName) {
  const tokens = buildMeasureTokens(measureName);
  const found = Object.entries(row).find(([key]) => {
    if (!isMeasureKey(key)) {
      return false;
    }

    const lowerKey = normalizeText(key);
    return tokens.some((token) => lowerKey.includes(normalizeText(token)));
  });

  return found ? Number(found[1]) || 0 : 0;
}

export function extractMeasureByKeywords(row, keywords) {
  const normalizedKeywords = keywords.map((k) => k.toLowerCase());
  const found = Object.entries(row).find(([key]) => {
    const lowerKey = key.toLowerCase();
    return isMeasureKey(key) && normalizedKeywords.some((k) => lowerKey.includes(k));
  });

  return found ? Number(found[1]) || 0 : 0;
}
