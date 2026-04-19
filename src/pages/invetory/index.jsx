import { Fragment, useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import MultiSelect from "../../components/MultiSelect";
import {
  extractDimensionCaptions,
  extractDimensionValue,
  extractMeasureByName,
  getDimensionMembers,
  queryOlapAllPages
} from "../../services/api/olap";
import {
  buildTimeSeriesByLevel,
  buildMatrixRows,
  formatAxisCurrency,
  formatCurrencyUSD,
  formatNumber,
  getLatestMember,
  truncateMiddle
} from "../olap-helpers";
import "./inventory.css";

const TIME_LEVELS = [
  { label: "Year", key: "TG.Year", tokens: ["year", "nam"] },
  { label: "Quarter", key: "TG.Quarter", tokens: ["quarter", "quy"] },
  { label: "Month", key: "TG.Month", tokens: ["month", "thang"] }
];

const LOCATION_LEVELS = [
  { label: "State", key: "DD.State", tokens: ["state", "bang"] },
  { label: "City", key: "DD.City", tokens: ["city", "thanh pho"] }
];

const MEASURE_COLUMNS = [
  { key: "quantity", label: "Quantity" },
  { key: "value", label: "Value ($)" },
  { key: "weight", label: "Weight" }
];

function parseYearMember(raw) {
  const text = String(raw || "").trim();
  const yearMatch = text.match(/(19|20)\d{2}/);
  if (yearMatch) {
    return Number(yearMatch[0]);
  }

  const numberMatch = text.match(/\d+/);
  return numberMatch ? Number(numberMatch[0]) : null;
}

function parseQuarterMember(raw) {
  const text = String(raw || "").trim();
  const quarterMatch = text.match(/q\s*([1-4])/i);
  if (quarterMatch) {
    return Number(quarterMatch[1]);
  }

  const compact = text.replace(/\s+/g, "");
  if (/^[1-4]$/.test(compact)) {
    return Number(compact);
  }

  return null;
}

function parseMonthMember(raw) {
  const text = String(raw || "").trim();
  const numberMatch = text.match(/\d{1,2}/);
  if (!numberMatch) {
    return null;
  }

  const month = Number(numberMatch[0]);
  return month >= 1 && month <= 12 ? month : null;
}

function isValidTimeParts(year, quarter, month) {
  return Number.isFinite(year)
    && Number.isFinite(quarter)
    && Number.isFinite(month)
    && year > 0
    && quarter >= 1
    && quarter <= 4
    && month >= 1
    && month <= 12;
}

function formatDecimalMax2(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value || "-");
  }

  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function MatrixTable({ matrix }) {
  return (
    <div className="matrix-wrap">
      <table className="matrix-table">
        <thead>
          <tr>
            {matrix.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildBarOption(rows, pivot, color, formatter, percent = false) {
  if (pivot) {
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { top: 22, left: 22, right: 12, bottom: 86 },
      xAxis: { type: "category", data: rows.map((item) => item.shortLabel), axisLabel: { rotate: 28 } },
      yAxis: { type: "value", axisLabel: { formatter: percent ? (value) => `${Number(value).toFixed(1)}%` : formatter } },
      series: [{ type: "bar", data: rows.map((item) => item.value), itemStyle: { color } }]
    };
  }

  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { top: 22, left: 130, right: 12, bottom: 24 },
    xAxis: { type: "value", axisLabel: { formatter: percent ? (value) => `${Number(value).toFixed(1)}%` : formatter } },
    yAxis: { type: "category", data: rows.map((item) => item.shortLabel), axisLabel: { fontSize: 10 } },
    series: [{ type: "bar", data: rows.map((item) => item.value), itemStyle: { color, borderRadius: [0, 6, 6, 0] } }]
  };
}

export default function InventoryPage() {
  const [timeLevelIndex, setTimeLevelIndex] = useState(2);
  const [locationLevelIndex, setLocationLevelIndex] = useState(1);
  const [isPivotProductDist, setIsPivotProductDist] = useState(false);
  const [isPivotQtyTime, setIsPivotQtyTime] = useState(false);
  const [isPivotValueStore, setIsPivotValueStore] = useState(false);
  const [isPivotStoreCountByLocation, setIsPivotStoreCountByLocation] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedQuarters, setSelectedQuarters] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedStores, setSelectedStores] = useState([]);
  const [quarterOptions, setQuarterOptions] = useState([]);
  const [monthOptions, setMonthOptions] = useState([]);

  const [valueRange, setValueRange] = useState({ min: "", max: "" });
  const [quantityRange, setQuantityRange] = useState({ min: "", max: "" });
  const [weightRange, setWeightRange] = useState({ min: "", max: "" });

  const [visibleMeasureColumns, setVisibleMeasureColumns] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [allFactRows, setAllFactRows] = useState([]);
  const [tablePage, setTablePage] = useState(1);
  const [expandedProductRowKey, setExpandedProductRowKey] = useState("");
  const [expandedStoreRowKey, setExpandedStoreRowKey] = useState("");

  const [yearOptions, setYearOptions] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);
  const [allCityOptions, setAllCityOptions] = useState([]);
  const [cityStateMap, setCityStateMap] = useState({});
  const [cityOptions, setCityOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [storeOptions, setStoreOptions] = useState([]);
  const [storeLocationMap, setStoreLocationMap] = useState({});

  const [appliedFilters, setAppliedFilters] = useState({
    years: [],
    quarters: [],
    months: [],
    states: [],
    cities: [],
    products: [],
    stores: [],
    valueMin: "",
    valueMax: "",
    quantityMin: "",
    quantityMax: "",
    weightMin: "",
    weightMax: ""
  });

  const timeLevel = TIME_LEVELS[timeLevelIndex] ?? TIME_LEVELS[2];
  const locationLevel = LOCATION_LEVELS[locationLevelIndex] ?? LOCATION_LEVELS[1];
  const latestYear = useMemo(() => getLatestMember(yearOptions), [yearOptions]);

  useEffect(() => {
    let mounted = true;

    async function loadOptions() {
      if (!mounted) {
        return;
      }

      try {
        const [years, states, products, stores, cityStateResponse, storeLocationResponse] = await Promise.all([
          getDimensionMembers({
            factGroup: "TonKho",
            cube: "TonKho",
            dimension: "TG.Year",
            measure: "Inventory.Value"
          }),
          getDimensionMembers({
            factGroup: "TonKho",
            cube: "TonKho",
            dimension: "DD.State",
            measure: "Inventory.Value"
          }),
          getDimensionMembers({
            factGroup: "TonKho",
            cube: "TonKho",
            dimension: "MH.ProductKey",
            measure: "Inventory.Value"
          }),
          getDimensionMembers({
            factGroup: "TonKho",
            cube: "TonKho",
            dimension: "CH.StoreKey",
            measure: "Inventory.Value"
          }),
          queryOlapAllPages({
            factGroup: "TonKho",
            cube: "TonKho",
            measures: ["Inventory.Value"],
            rows: ["DD.State", "DD.City"],
            columns: [],
            filters: {},
            page: 1,
            pageSize: 500
          }, {
            pageSize: 500,
            maxPages: 20,
            useCache: true
          }),
          queryOlapAllPages({
            factGroup: "TonKho",
            cube: "TonKho",
            measures: ["Inventory.Value"],
            rows: ["CH.StoreKey", "DD.State", "DD.City"],
            columns: [],
            filters: {},
            page: 1,
            pageSize: 500
          }, {
            pageSize: 500,
            maxPages: 20,
            useCache: true
          })
        ]);

        if (!mounted) {
          return;
        }

        const nextCityStateMap = {};
        const uniqueCities = new Map();
        (cityStateResponse?.data || []).forEach((row) => {
          const state = extractDimensionValue(row, ["state", "bang"]) || "Unknown";
          const city = extractDimensionValue(row, ["city", "thanh pho"]) || "Unknown";
          const cityKey = String(city);
          if (!nextCityStateMap[cityKey]) {
            nextCityStateMap[cityKey] = new Set();
          }
          nextCityStateMap[cityKey].add(state);
          if (!uniqueCities.has(cityKey)) {
            uniqueCities.set(cityKey, { value: cityKey, label: cityKey });
          }
        });

        const nextStoreLocationMap = {};
        (storeLocationResponse?.data || []).forEach((row) => {
          const storeKey = String(extractDimensionValue(row, ["storekey", "cua hang"]) || "").trim();
          if (!storeKey) {
            return;
          }

          const state = extractDimensionValue(row, ["state", "bang"]) || "Unknown";
          const city = extractDimensionValue(row, ["city", "thanh pho"]) || "Unknown";

          if (!nextStoreLocationMap[storeKey]) {
            nextStoreLocationMap[storeKey] = {
              states: new Set(),
              cities: new Set()
            };
          }

          nextStoreLocationMap[storeKey].states.add(String(state));
          nextStoreLocationMap[storeKey].cities.add(String(city));
        });

        setYearOptions(years);
        setStateOptions(states);
        setAllCityOptions([...uniqueCities.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })));
        setCityStateMap(nextCityStateMap);
        setProductOptions(products);
        setStoreOptions(stores);
        setStoreLocationMap(nextStoreLocationMap);
      } catch {
        // Keep options empty when metadata call fails.
      }
    }

    loadOptions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (timeLevelIndex === 0) {
      setSelectedQuarters([]);
      setSelectedMonths([]);
    }
    if (timeLevelIndex === 1) {
      setSelectedMonths([]);
    }
  }, [timeLevelIndex]);

  useEffect(() => {
    let mounted = true;

    async function loadTimeMembers() {
      const quarterFilters = selectedYears.length > 0
        ? [{ key: "TG.Year", values: selectedYears }]
        : [];

      const monthFilters = [...quarterFilters];
      if (selectedQuarters.length > 0) {
        monthFilters.push({ key: "TG.Quarter", values: selectedQuarters });
      }

      try {
        const [quarters, months] = await Promise.all([
          getDimensionMembers({
            factGroup: "TonKho",
            cube: "TonKho",
            dimension: "TG.Quarter",
            measure: "Inventory.Value",
            filters: quarterFilters
          }),
          getDimensionMembers({
            factGroup: "TonKho",
            cube: "TonKho",
            dimension: "TG.Month",
            measure: "Inventory.Value",
            filters: monthFilters
          })
        ]);

        if (!mounted) {
          return;
        }

        setQuarterOptions(quarters);
        setMonthOptions(months);
      } catch {
        if (mounted) {
          setQuarterOptions([]);
          setMonthOptions([]);
        }
      }
    }

    loadTimeMembers();
    return () => {
      mounted = false;
    };
  }, [selectedQuarters, selectedYears]);

  useEffect(() => {
    if (selectedStates.length === 0) {
      setCityOptions(allCityOptions);
      return;
    }

    const next = allCityOptions.filter((option) => {
      const states = cityStateMap[option.value];
      if (!states) return false;
      return selectedStates.some((state) => states.has(state));
    });
    setCityOptions(next);
  }, [allCityOptions, cityStateMap, selectedStates]);

  useEffect(() => {
    const valid = new Set(cityOptions.map((item) => item.value));
    setSelectedCities((previous) => previous.filter((city) => valid.has(city)));
  }, [cityOptions]);

  useEffect(() => {
    const validQuarters = new Set(quarterOptions.map((item) => item.value));
    setSelectedQuarters((previous) => previous.filter((quarter) => validQuarters.has(quarter)));
  }, [quarterOptions]);

  useEffect(() => {
    const validMonths = new Set(monthOptions.map((item) => item.value));
    setSelectedMonths((previous) => previous.filter((month) => validMonths.has(month)));
  }, [monthOptions]);

  useEffect(() => {
    if (yearOptions.length > 0) return;
    const fallbackYears = [...new Set(allFactRows.map((row) => row.year).filter((year) => year > 0))]
      .sort((a, b) => a - b)
      .map((value) => ({ value: String(value), label: String(value) }));
    if (fallbackYears.length > 0) setYearOptions(fallbackYears);
  }, [allFactRows, yearOptions.length]);

  useEffect(() => {
    if (!latestYear) return;
    setSelectedYears((prev) => (prev.length > 0 ? prev : [latestYear]));
    setAppliedFilters((prev) => (prev.years.length > 0 ? prev : { ...prev, years: [latestYear] }));
  }, [latestYear]);

  useEffect(() => {
    if (productOptions.length > 0) return;
    const fallback = [...new Set(allFactRows.map((row) => String(row.productKey || "")).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      .map((value) => ({ value, label: value }));
    if (fallback.length > 0) setProductOptions(fallback);
  }, [allFactRows, productOptions.length]);

  useEffect(() => {
    if (storeOptions.length > 0) return;
    const fallback = [...new Set(allFactRows.map((row) => String(row.storeKey || "")).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      .map((value) => ({ value, label: value }));
    if (fallback.length > 0) setStoreOptions(fallback);
  }, [allFactRows, storeOptions.length]);

  const visibleStoreOptions = useMemo(() => {
    if (selectedStates.length === 0 && selectedCities.length === 0) return storeOptions;
    return storeOptions.filter((option) => {
      const location = storeLocationMap[option.value];
      if (!location) return false;
      const matchedState = selectedStates.length === 0 || selectedStates.some((state) => location.states.has(state));
      const matchedCity = selectedCities.length === 0 || selectedCities.some((city) => location.cities.has(city));
      return matchedState && matchedCity;
    });
  }, [selectedCities, selectedStates, storeLocationMap, storeOptions]);

  useEffect(() => {
    const validStores = new Set(visibleStoreOptions.map((item) => item.value));
    setSelectedStores((prev) => prev.filter((store) => validStores.has(store)));
  }, [visibleStoreOptions]);

  const filters = useMemo(() => {
    const next = [];

    if (appliedFilters.years.length > 0) {
      next.push({ key: "TG.Year", values: appliedFilters.years });
    }
    if (appliedFilters.quarters.length > 0) {
      next.push({ key: "TG.Quarter", values: appliedFilters.quarters });
    }
    if (appliedFilters.months.length > 0) {
      next.push({ key: "TG.Month", values: appliedFilters.months });
    }

    if (appliedFilters.states.length > 0) {
      next.push({ key: "DD.State", values: appliedFilters.states });
    }
    if (appliedFilters.cities.length > 0) {
      next.push({ key: "DD.City", values: appliedFilters.cities });
    }

    if (appliedFilters.products.length > 0) {
      next.push({ key: "MH.ProductKey", values: appliedFilters.products });
    }
    if (appliedFilters.stores.length > 0) {
      next.push({ key: "CH.StoreKey", values: appliedFilters.stores });
    }

    return next;
  }, [appliedFilters]);

  const measureRanges = useMemo(() => {
    const ranges = {};

    if (appliedFilters.quantityMin !== "" || appliedFilters.quantityMax !== "") {
      ranges["Inventory.Quantity"] = {
        min: appliedFilters.quantityMin === "" ? null : Number(appliedFilters.quantityMin),
        max: appliedFilters.quantityMax === "" ? null : Number(appliedFilters.quantityMax)
      };
    }

    if (appliedFilters.valueMin !== "" || appliedFilters.valueMax !== "") {
      ranges["Inventory.Value"] = {
        min: appliedFilters.valueMin === "" ? null : Number(appliedFilters.valueMin),
        max: appliedFilters.valueMax === "" ? null : Number(appliedFilters.valueMax)
      };
    }

    if (appliedFilters.weightMin !== "" || appliedFilters.weightMax !== "") {
      ranges["Inventory.Weight"] = {
        min: appliedFilters.weightMin === "" ? null : Number(appliedFilters.weightMin),
        max: appliedFilters.weightMax === "" ? null : Number(appliedFilters.weightMax)
      };
    }

    return ranges;
  }, [
    appliedFilters.quantityMax,
    appliedFilters.quantityMin,
    appliedFilters.valueMax,
    appliedFilters.valueMin,
    appliedFilters.weightMax,
    appliedFilters.weightMin
  ]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const response = await queryOlapAllPages({
          factGroup: "TonKho",
          cube: "TonKho",
          measures: ["Inventory.Quantity", "Inventory.Value", "Inventory.Weight"],
          rows: [
            "MH.ProductKey",
            "MH.Description",
            "MH.Size",
            "MH.Weight",
            "CH.StoreKey",
            "CH.LocationKey",
            "CH.Phone",
            "DD.State",
            "DD.City",
            "TG.Year",
            "TG.Quarter",
            "TG.Month"
          ],
          columns: [],
          filters,
          measureRanges,
          page: 1,
          pageSize: 500
        }, {
          pageSize: 500,
          maxPages: 200,
          useCache: false
        });

        if (!mounted) {
          return;
        }

        const normalizedRows = (response.data || []).map((row) => {
          const captions = extractDimensionCaptions(row).map((entry) => String(entry.value || "").trim());

          const productKeyRaw = captions[0] || extractDimensionValue(row, ["productkey", "mat hang"]);
          const descriptionRaw = captions[1] || extractDimensionValue(row, ["description", "mo ta"]);
          const sizeRaw = captions[2] || extractDimensionValue(row, ["size", "kich thuoc"]);
          const productWeightRaw = captions[3] || extractDimensionValue(row, ["weight", "trong luong"]);
          const storeKeyRaw = captions[4] || extractDimensionValue(row, ["storekey", "cua hang"]);
          const storeLocationKeyRaw = captions[5] || extractDimensionValue(row, ["locationkey", "dia diem"]);
          const storePhoneRaw = captions[6] || extractDimensionValue(row, ["phone", "so dien thoai"]);
          const stateRaw = captions[7] || extractDimensionValue(row, ["state", "bang"]);
          const cityRaw = captions[8] || extractDimensionValue(row, ["city", "thanh pho"]);
          const yearRaw = captions[9] || extractDimensionValue(row, ["year", "nam"]);
          const quarterRaw = captions[10] || extractDimensionValue(row, ["quarter", "quy"]);
          const monthRaw = captions[11] || extractDimensionValue(row, ["month", "thang"]);

          const year = parseYearMember(yearRaw);
          const quarter = parseQuarterMember(quarterRaw);
          const month = parseMonthMember(monthRaw);

          return {
            productKey: productKeyRaw || "Unknown",
            productDescription: descriptionRaw || "N/A",
            productSize: sizeRaw || "N/A",
            productWeight: productWeightRaw || "N/A",
            storeKey: storeKeyRaw || "Unknown",
            storeLocationKey: storeLocationKeyRaw || "N/A",
            storePhone: storePhoneRaw || "N/A",
            state: stateRaw || "Unknown",
            city: cityRaw || "Unknown",
            year,
            quarter,
            month,
            quantity: extractMeasureByName(row, "Inventory.Quantity"),
            value: extractMeasureByName(row, "Inventory.Value"),
            weight: extractMeasureByName(row, "Inventory.Weight")
          };
        }).filter((row) => isValidTimeParts(row.year, row.quarter, row.month));

        setAllFactRows(normalizedRows);
      } catch (err) {
        if (mounted) {
          setError(err.message || "Failed to load inventory data.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [filters, measureRanges]);

  function applyFilters() {
    setAppliedFilters({
      years: [...selectedYears],
      quarters: [...selectedQuarters],
      months: [...selectedMonths],
      states: [...selectedStates],
      cities: [...selectedCities],
      products: [...selectedProducts],
      stores: [...selectedStores],
      valueMin: valueRange.min,
      valueMax: valueRange.max,
      quantityMin: quantityRange.min,
      quantityMax: quantityRange.max,
      weightMin: weightRange.min,
      weightMax: weightRange.max
    });
  }

  function resetFilters() {
    const defaultYears = latestYear ? [latestYear] : [];

    setSelectedYears(defaultYears);
    setSelectedQuarters([]);
    setSelectedMonths([]);
    setSelectedStates([]);
    setSelectedCities([]);
    setSelectedProducts([]);
    setSelectedStores([]);
    setValueRange({ min: "", max: "" });
    setQuantityRange({ min: "", max: "" });
    setWeightRange({ min: "", max: "" });
    setAppliedFilters({
      years: [...defaultYears],
      quarters: [],
      months: [],
      states: [],
      cities: [],
      products: [],
      stores: [],
      valueMin: "",
      valueMax: "",
      quantityMin: "",
      quantityMax: "",
      weightMin: "",
      weightMax: ""
    });
  }

  const filteredFactRows = useMemo(() => allFactRows, [allFactRows]);

  const totals = useMemo(() => ({
    quantity: filteredFactRows.reduce((sum, row) => sum + row.quantity, 0),
    value: filteredFactRows.reduce((sum, row) => sum + row.value, 0),
    weight: filteredFactRows.reduce((sum, row) => sum + row.weight, 0)
  }), [filteredFactRows]);

  const sortedFactRows = useMemo(
    () => [...filteredFactRows].sort((a, b) => b.value - a.value),
    [filteredFactRows]
  );

  const totalTablePages = useMemo(
    () => Math.max(1, Math.ceil(sortedFactRows.length / 20)),
    [sortedFactRows.length]
  );

  const pagedFactRows = useMemo(() => {
    const start = (tablePage - 1) * 20;
    return sortedFactRows.slice(start, start + 20);
  }, [sortedFactRows, tablePage]);

  useEffect(() => {
    setTablePage(1);
    setExpandedProductRowKey("");
    setExpandedStoreRowKey("");
  }, [appliedFilters]);

  useEffect(() => {
    setTablePage((previous) => Math.min(previous, totalTablePages));
  }, [totalTablePages]);

  const productDistByStoreRows = useMemo(() => {
    const storeToProducts = new Map();

    filteredFactRows.forEach((row) => {
      const key = row.storeKey;
      if (!storeToProducts.has(key)) {
        storeToProducts.set(key, new Set());
      }
      storeToProducts.get(key).add(row.productKey);
    });

    return [...storeToProducts.entries()]
      .map(([label, set]) => ({ label, shortLabel: truncateMiddle(label, 20, 7, 5), value: set.size }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [filteredFactRows]);

  const quantityTimeData = useMemo(() => buildTimeSeriesByLevel(filteredFactRows, {
    level: timeLevel.key,
    getYear: (row) => row.year,
    getQuarter: (row) => row.quarter,
    getMonth: (row) => row.month,
    getValue: (row) => row.quantity
  }), [filteredFactRows, timeLevel.key]);

  const valueByStoreRows = useMemo(() => {
    const map = new Map();
    filteredFactRows.forEach((row) => {
      map.set(row.storeKey, (map.get(row.storeKey) || 0) + row.value);
    });

    return [...map.entries()]
      .map(([label, value]) => ({ label, shortLabel: truncateMiddle(label, 20, 7, 5), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [filteredFactRows]);

  const storeCountByLocationRows = useMemo(() => {
    const locationStoreMap = new Map();

    filteredFactRows.forEach((row) => {
      const locationLabel = locationLevel.key === "DD.City"
        ? (row.city || "Unknown")
        : (row.state || "Unknown");

      if (!locationStoreMap.has(locationLabel)) {
        locationStoreMap.set(locationLabel, new Set());
      }

      locationStoreMap.get(locationLabel).add(row.storeKey);
    });

    return [...locationStoreMap.entries()]
      .map(([label, storeSet]) => ({
        label,
        shortLabel: truncateMiddle(label, 20, 7, 5),
        value: storeSet.size
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [filteredFactRows, locationLevel.key]);

  const locationHierarchyColumns = useMemo(
    () => (locationLevel.key === "DD.City" ? ["City", "State"] : ["State"]),
    [locationLevel.key]
  );

  const timeHierarchyColumns = useMemo(() => {
    if (timeLevel.key === "TG.Year") {
      return ["Year"];
    }

    if (timeLevel.key === "TG.Quarter") {
      return ["Quarter", "Year"];
    }

    return ["Month", "Quarter", "Year"];
  }, [timeLevel.key]);

  function toggleExpandedProductRow(rowKey) {
    setExpandedProductRowKey((previous) => (previous === rowKey ? "" : rowKey));
  }

  function toggleExpandedStoreRow(rowKey) {
    setExpandedStoreRowKey((previous) => (previous === rowKey ? "" : rowKey));
  }

  const productDistByStoreOption = useMemo(
    () => buildBarOption(productDistByStoreRows, isPivotProductDist, "#14532d", (value) => formatNumber(value)),
    [isPivotProductDist, productDistByStoreRows]
  );

  const quantityByTimeOption = useMemo(() => {
    if (quantityTimeData.mode === "year") {
      return {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: quantityTimeData.years },
        yAxis: { type: "value", axisLabel: { formatter: (value) => formatNumber(value) } },
        series: [{ type: "bar", data: quantityTimeData.seriesByYear.map((item) => item.values[0] || 0), itemStyle: { color: "#0f766e" } }]
      };
    }

    if (isPivotQtyTime) {
      const pivotValues = quantityTimeData.buckets.map((_, bucketIdx) => (
        quantityTimeData.seriesByYear.reduce((sum, yearSeries) => sum + (yearSeries.values[bucketIdx] || 0), 0)
      ));

      return {
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        grid: { top: 22, left: 22, right: 12, bottom: 86 },
        xAxis: { type: "category", data: quantityTimeData.buckets, axisLabel: { rotate: 28 } },
        yAxis: { type: "value", axisLabel: { formatter: (value) => formatNumber(value) } },
        series: [{ type: "bar", data: pivotValues, itemStyle: { color: "#0f766e" } }]
      };
    }

    return {
      tooltip: { trigger: "axis" },
      legend: { top: 0, data: quantityTimeData.seriesByYear.map((item) => `Year ${item.year}`) },
      grid: { top: 40, left: 36, right: 12, bottom: 42 },
      xAxis: { type: "category", data: quantityTimeData.buckets },
      yAxis: { type: "value", axisLabel: { formatter: (value) => formatNumber(value) } },
      series: quantityTimeData.seriesByYear.map((item) => ({
        name: `Year ${item.year}`,
        type: "line",
        smooth: true,
        data: item.values
      }))
    };
  }, [isPivotQtyTime, quantityTimeData]);

  const valueByStoreOption = useMemo(
    () => buildBarOption(valueByStoreRows, isPivotValueStore, "#1456a0", formatAxisCurrency),
    [isPivotValueStore, valueByStoreRows]
  );

  const storeCountByLocationOption = useMemo(
    () => buildBarOption(storeCountByLocationRows, isPivotStoreCountByLocation, "#a16207", (value) => formatNumber(value)),
    [isPivotStoreCountByLocation, storeCountByLocationRows]
  );

  const visibleMeasureSet = useMemo(() => {
    if (visibleMeasureColumns.length === 0) {
      return new Set(MEASURE_COLUMNS.map((item) => item.key));
    }
    return new Set(visibleMeasureColumns);
  }, [visibleMeasureColumns]);

  const factTableColSpan = 2 + locationHierarchyColumns.length + timeHierarchyColumns.length + [...visibleMeasureSet].length;

  const productDistMatrix = useMemo(() => buildMatrixRows(
    productDistByStoreRows.map((item) => ({ label: item.label, value: item.value })),
    isPivotProductDist,
    "Store",
    "Number of Products",
    formatNumber
  ), [isPivotProductDist, productDistByStoreRows]);

  const quantityTimeMatrix = useMemo(() => {
    if (quantityTimeData.mode === "year") {
      return {
        headers: ["Year", "Quantity"],
        rows: quantityTimeData.seriesByYear.map((item) => [item.year, formatNumber(item.values[0] || 0)])
      };
    }

    if (!isPivotQtyTime) {
      return {
        headers: ["Year", ...quantityTimeData.buckets],
        rows: quantityTimeData.seriesByYear.map((item) => [
          item.year,
          ...item.values.map((value) => formatNumber(value))
        ])
      };
    }

    return {
      headers: [timeLevel.label, ...quantityTimeData.years],
      rows: quantityTimeData.buckets.map((bucket, bucketIdx) => [
        bucket,
        ...quantityTimeData.seriesByYear.map((item) => formatNumber(item.values[bucketIdx] || 0))
      ])
    };
  }, [isPivotQtyTime, quantityTimeData, timeLevel.label]);

  const valueByStoreMatrix = useMemo(() => buildMatrixRows(
    valueByStoreRows.map((item) => ({ label: item.label, value: item.value })),
    isPivotValueStore,
    "Store",
    "Value ($)",
    formatCurrencyUSD
  ), [isPivotValueStore, valueByStoreRows]);

  const storeCountByLocationMatrix = useMemo(() => buildMatrixRows(
    storeCountByLocationRows.map((item) => ({ label: item.label, value: item.value })),
    isPivotStoreCountByLocation,
    locationLevel.label,
    "Number of Stores",
    formatNumber
  ), [isPivotStoreCountByLocation, locationLevel.label, storeCountByLocationRows]);

  return (
    <section className="inventory-page olap-page">
      <header className="olap-header">
        <h1>Inventory Analysis</h1>
        <p>Inventory metrics with hierarchical filters.</p>
      </header>

      <div className="olap-layout-toolbar">
        <button
          type="button"
          className="filter-toggle-btn"
          onClick={() => setIsFilterOpen((previous) => !previous)}
        >
          {isFilterOpen ? "Hide Filters" : "Show Filters"}
        </button>
      </div>

      <div className={`olap-layout ${isFilterOpen ? "" : "olap-layout--panel-collapsed"}`}>
        <div className="olap-main">
          <section className="olap-card">
            <h3 className="olap-card__title">Hierarchy</h3>
            <div className="olap-hierarchy-grid">
              <div className="hierarchy-control">
                <div className="hierarchy-control__head">
                  <strong>Time Hierarchy</strong>
                  <span>{timeLevel.label}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={TIME_LEVELS.length - 1}
                  value={timeLevelIndex}
                  onChange={(event) => setTimeLevelIndex(Number(event.target.value))}
                />
                <div className="hierarchy-control__steps">
                  {TIME_LEVELS.map((level) => <span key={level.key}>{level.label}</span>)}
                </div>
              </div>

              <div className="hierarchy-control">
                <div className="hierarchy-control__head">
                  <strong>Location Hierarchy</strong>
                  <span>{locationLevel.label}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={LOCATION_LEVELS.length - 1}
                  value={locationLevelIndex}
                  onChange={(event) => setLocationLevelIndex(Number(event.target.value))}
                />
                <div className="hierarchy-control__steps">
                  {LOCATION_LEVELS.map((level) => <span key={level.key}>{level.label}</span>)}
                </div>
              </div>
            </div>
            {loading ? <p className="olap-loading-badge">Loading data...</p> : null}
          </section>

          <section className="olap-kpis">
            <article className="olap-kpi">
              <p>Total Quantity</p>
              <h3>{formatNumber(totals.quantity)}</h3>
            </article>
            <article className="olap-kpi">
              <p>Total Value</p>
              <h3>{formatCurrencyUSD(totals.value)}</h3>
            </article>
            <article className="olap-kpi">
              <p>Total Weight</p>
              <h3>{formatNumber(totals.weight)}</h3>
            </article>
          </section>

          {error ? <p className="empty-message">{error}</p> : null}

          <section className="olap-charts">
            <article className="olap-chart-card">
              <div className="olap-chart-card__head">
                <h4>Product Mix by Store</h4>
                <button type="button" className="pivot-btn" onClick={() => setIsPivotProductDist((previous) => !previous)}>Pivot</button>
              </div>
              <ReactECharts notMerge={true} option={productDistByStoreOption} style={{ height: "300px" }} />
              <MatrixTable matrix={productDistMatrix} />
            </article>

            <article className="olap-chart-card">
              <div className="olap-chart-card__head">
                <h4>Inventory Quantity Over Time</h4>
                <button type="button" className="pivot-btn" onClick={() => setIsPivotQtyTime((previous) => !previous)}>Pivot</button>
              </div>
              <ReactECharts notMerge={true}
                key={`inventory-quantity-time-${timeLevel.key}-${isPivotQtyTime ? "pivot" : "base"}`}
                option={quantityByTimeOption}
                notMerge
                style={{ height: "300px" }}
              />
              <MatrixTable matrix={quantityTimeMatrix} />
            </article>

            <article className="olap-chart-card">
              <div className="olap-chart-card__head">
                <h4>Inventory Value by Store</h4>
                <button type="button" className="pivot-btn" onClick={() => setIsPivotValueStore((previous) => !previous)}>Pivot</button>
              </div>
              <ReactECharts notMerge={true} option={valueByStoreOption} style={{ height: "300px" }} />
              <MatrixTable matrix={valueByStoreMatrix} />
            </article>

            <article className="olap-chart-card">
              <div className="olap-chart-card__head">
                <h4>Store Count by {locationLevel.label}</h4>
                <button type="button" className="pivot-btn" onClick={() => setIsPivotStoreCountByLocation((previous) => !previous)}>Pivot</button>
              </div>
              <ReactECharts notMerge={true} option={storeCountByLocationOption} style={{ height: "300px" }} />
              <MatrixTable matrix={storeCountByLocationMatrix} />
            </article>
          </section>

          <section className="olap-card">
            <h3 className="olap-card__title">Fact Rows</h3>
            <div className="fact-table-wrap">
              <table className="fact-table">
                <thead>
                  <tr>
                    <th>Product Key</th>
                    <th>Store Key</th>
                    {locationHierarchyColumns.map((column) => (
                      <th key={`location-col-${column}`}>{column}</th>
                    ))}
                    {timeHierarchyColumns.map((column) => (
                      <th key={`time-col-${column}`}>{column}</th>
                    ))}
                    {visibleMeasureSet.has("quantity") ? <th className="num">Quantity</th> : null}
                    {visibleMeasureSet.has("value") ? <th className="num">Value ($)</th> : null}
                    {visibleMeasureSet.has("weight") ? <th className="num">Weight</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {pagedFactRows.length > 0 ? pagedFactRows.map((row, index) => {
                    const rowKey = `${row.productKey}-${row.storeKey}-${row.year}-${row.quarter}-${row.month}-${index}`;
                    const isProductExpanded = expandedProductRowKey === rowKey;
                    const isStoreExpanded = expandedStoreRowKey === rowKey;

                    return (
                      <Fragment key={rowKey}>
                        <tr>
                          <td title={row.productKey}>
                            <div className="fact-key-inline">
                              <span className="fact-key-text">{row.productKey}</span>
                              <button
                                type="button"
                                className="expand-btn fact-key-plus"
                                onClick={() => toggleExpandedProductRow(rowKey)}
                                aria-label={isProductExpanded ? "Collapse product details" : "Expand product details"}
                              >
                                {isProductExpanded ? "-" : "+"}
                              </button>
                            </div>
                          </td>
                          <td title={row.storeKey}>
                            <div className="fact-key-inline">
                              <span className="fact-key-text">{row.storeKey}</span>
                              <button
                                type="button"
                                className="expand-btn fact-key-plus"
                                onClick={() => toggleExpandedStoreRow(rowKey)}
                                aria-label={isStoreExpanded ? "Collapse store details" : "Expand store details"}
                              >
                                {isStoreExpanded ? "-" : "+"}
                              </button>
                            </div>
                          </td>
                          {locationHierarchyColumns.map((column) => {
                            if (column === "City") {
                              return <td key={`${rowKey}-loc-city`}>{row.city || "-"}</td>;
                            }
                            return <td key={`${rowKey}-loc-state`}>{row.state || "-"}</td>;
                          })}
                          {timeHierarchyColumns.map((column) => {
                            if (column === "Year") {
                              return <td key={`${rowKey}-time-year`}>{row.year || "-"}</td>;
                            }

                            if (column === "Quarter") {
                              return <td key={`${rowKey}-time-quarter`}>{row.quarter ? `Q${row.quarter}` : "-"}</td>;
                            }

                            return <td key={`${rowKey}-time-month`}>{row.month ? `M${row.month}` : "-"}</td>;
                          })}
                          {visibleMeasureSet.has("quantity") ? <td className="num">{formatNumber(row.quantity)}</td> : null}
                          {visibleMeasureSet.has("value") ? <td className="num">{formatCurrencyUSD(row.value)}</td> : null}
                          {visibleMeasureSet.has("weight") ? <td className="num">{formatNumber(row.weight)}</td> : null}
                        </tr>
                        {isProductExpanded ? (
                          <tr className="expand-detail">
                            <td colSpan={factTableColSpan}>
                              <div className="expand-detail__grid">
                                <div className="expand-detail__item">
                                  <span>Product Description</span>
                                  <strong>{row.productDescription}</strong>
                                </div>
                                <div className="expand-detail__item">
                                  <span>Product Size</span>
                                  <strong>{row.productSize}</strong>
                                </div>
                                <div className="expand-detail__item">
                                  <span>Product Weight</span>
                                  <strong>{formatDecimalMax2(row.productWeight)}</strong>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                        {isStoreExpanded ? (
                          <tr className="expand-detail">
                            <td colSpan={factTableColSpan}>
                              <div className="expand-detail__grid">
                                <div className="expand-detail__item">
                                  <span>Store Phone</span>
                                  <strong>{row.storePhone}</strong>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  }) : (
                    <tr>
                      <td colSpan={factTableColSpan} className="empty-message">No data available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-pagination">
              <button
                type="button"
                onClick={() => setTablePage((previous) => Math.max(1, previous - 1))}
                disabled={tablePage <= 1}
              >
                Prev
              </button>
              <span>{`Page ${tablePage} / ${totalTablePages}`}</span>
              <button
                type="button"
                onClick={() => setTablePage((previous) => Math.min(totalTablePages, previous + 1))}
                disabled={tablePage >= totalTablePages}
              >
                Next
              </button>
            </div>
          </section>
        </div>

        <aside className={`olap-panel ${isFilterOpen ? "" : "olap-panel--hidden"}`}>
          <h3>Filters</h3>

          <div className="olap-panel-group">
            <p className="olap-panel-group__title">Apply Filters</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <button type="button" className="filter-toggle-btn" onClick={applyFilters}>Apply</button>
              <button type="button" className="filter-toggle-btn" onClick={resetFilters}>Reset</button>
            </div>
          </div>

          <div className="olap-panel-group">
            <p className="olap-panel-group__title">Hierarchy Members</p>
            <MultiSelect label="Year" values={selectedYears} options={yearOptions} onChange={setSelectedYears} />
            {timeLevelIndex >= 1 ? (
              <MultiSelect label="Quarter" values={selectedQuarters} options={quarterOptions} onChange={setSelectedQuarters} />
            ) : null}
            {timeLevelIndex >= 2 ? (
              <MultiSelect label="Month" values={selectedMonths} options={monthOptions} onChange={setSelectedMonths} />
            ) : null}
            <MultiSelect label="State" values={selectedStates} options={stateOptions} onChange={setSelectedStates} />
            {locationLevel.key === "DD.City" ? (
              <MultiSelect label="City" values={selectedCities} options={cityOptions} onChange={setSelectedCities} />
            ) : null}
          </div>

          <div className="olap-panel-group">
            <p className="olap-panel-group__title">Dimension Keys</p>
            <MultiSelect label="Product Key" values={selectedProducts} options={productOptions} onChange={setSelectedProducts} />
            <MultiSelect label="Store Key" values={selectedStores} options={visibleStoreOptions} onChange={setSelectedStores} />
          </div>

          <div className="olap-panel-group">
            <p className="olap-panel-group__title">Projection</p>
            <MultiSelect
              label="Visible Columns"
              values={visibleMeasureColumns}
              options={MEASURE_COLUMNS.map((item) => ({ value: item.key, label: item.label }))}
              onChange={setVisibleMeasureColumns}
            />
          </div>

          <div className="olap-panel-group">
            <p className="olap-panel-group__title">Measure Ranges</p>
            <div className="metric-range">
              <label>
                Value Min
                <input
                  type="number"
                  value={valueRange.min}
                  onChange={(event) => setValueRange((prev) => ({ ...prev, min: event.target.value }))}
                />
              </label>
              <label>
                Value Max
                <input
                  type="number"
                  value={valueRange.max}
                  onChange={(event) => setValueRange((prev) => ({ ...prev, max: event.target.value }))}
                />
              </label>
            </div>
            <div className="metric-range">
              <label>
                Quantity Min
                <input
                  type="number"
                  value={quantityRange.min}
                  onChange={(event) => setQuantityRange((prev) => ({ ...prev, min: event.target.value }))}
                />
              </label>
              <label>
                Quantity Max
                <input
                  type="number"
                  value={quantityRange.max}
                  onChange={(event) => setQuantityRange((prev) => ({ ...prev, max: event.target.value }))}
                />
              </label>
            </div>
            <div className="metric-range">
              <label>
                Weight Min
                <input
                  type="number"
                  value={weightRange.min}
                  onChange={(event) => setWeightRange((prev) => ({ ...prev, min: event.target.value }))}
                />
              </label>
              <label>
                Weight Max
                <input
                  type="number"
                  value={weightRange.max}
                  onChange={(event) => setWeightRange((prev) => ({ ...prev, max: event.target.value }))}
                />
              </label>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
