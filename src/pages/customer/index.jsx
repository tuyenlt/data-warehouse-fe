import { Fragment, useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import MultiSelect from "../../components/MultiSelect";
import {
  extractDimensionValue,
  extractMeasureByName,
  getDimensionMembers,
  queryOlapAllPages
} from "../../services/api/olap";
import {
  buildTimeLabel,
  buildTimeSeriesByLevel,
  formatAxisCurrency,
  formatCurrencyUSD,
  formatNumber,
  getLatestMember,
  truncateMiddle
} from "../olap-helpers";
import "./customer.css";

const TIME_LEVELS = [
  { label: "Year", key: "TG.Year", tokens: ["year", "nam"] },
  { label: "Quarter", key: "TG.Quarter", tokens: ["quarter", "quy"] },
  { label: "Month", key: "TG.Month", tokens: ["month", "thang"] }
];

const LOCATION_LEVELS = [
  { label: "State", key: "DD.State" },
  { label: "City", key: "DD.City" }
];

const MEASURE_COLUMNS = [
  { key: "totalItems", label: "Total Items" },
  { key: "totalRevenue", label: "Revenue ($)" },
  { key: "avgOrderValue", label: "Average Order Value ($)" }
];

const FACT_PAGE_SIZE = 500;

function parseDateParts(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) {
    return null;
  }

  if (/^\d+$/.test(text)) {
    if (text.length === 8) {
      const year = Number(text.slice(0, 4));
      const month = Number(text.slice(4, 6));
      if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
        return { year, quarter: Math.ceil(month / 3), month };
      }
    }
    return null;
  }

  const isoMatch = text.match(/(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
      const quarter = Math.ceil(month / 3);
      return { year, quarter, month };
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = parsed.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return { year, quarter, month };
  }

  return null;
}


function ChartDataTable({ headers, rows }) {
  return (
    <div className="matrix-wrap">
      <table className="matrix-table">
        <thead>
          <tr>
            {headers.map((header) => <th key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`}>
              {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}
            </tr>
          )) : (
            <tr>
              <td colSpan={headers.length} className="empty-message">No data available.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomerPage() {
  const [timeLevelIndex, setTimeLevelIndex] = useState(2);
  const [locationLevelIndex, setLocationLevelIndex] = useState(1);
  const [isPivotUsersBuyTime, setIsPivotUsersBuyTime] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedQuarters, setSelectedQuarters] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedCustomerKeys, setSelectedCustomerKeys] = useState([]);
  const [quarterOptions, setQuarterOptions] = useState([]);
  const [monthOptions, setMonthOptions] = useState([]);

  const [totalItemsRange, setTotalItemsRange] = useState({ min: "", max: "" });
  const [totalRevenueRange, setTotalRevenueRange] = useState({ min: "", max: "" });

  const [visibleMeasureColumns, setVisibleMeasureColumns] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [allFactRows, setAllFactRows] = useState([]);
  const [tablePage, setTablePage] = useState(1);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  const [yearOptions, setYearOptions] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);
  const [allCityOptions, setAllCityOptions] = useState([]);
  const [cityStateMap, setCityStateMap] = useState({});
  const [cityOptions, setCityOptions] = useState([]);
  const [customerKeyOptions, setCustomerKeyOptions] = useState([]);
  const [customerLocationMap, setCustomerLocationMap] = useState({});
  const [firstOrderDateFilterValues, setFirstOrderDateFilterValues] = useState([]);
  const [firstOrderDateLookup, setFirstOrderDateLookup] = useState({});

  const [appliedFilters, setAppliedFilters] = useState({
    years: [],
    quarters: [],
    months: [],
    types: [],
    states: [],
    cities: [],
    customerKeys: [],
    totalItemsMin: "",
    totalItemsMax: "",
    totalRevenueMin: "",
    totalRevenueMax: ""
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
        const [
          yearMembersResult,
          customerTypesResult,
          statesResult,
          customerKeysResult,
          cityStateResult,
          customerLocationResult,
          timeKeyLookupResult
        ] = await Promise.allSettled([
          getDimensionMembers({
            factGroup: "HanhVi",
            cube: "HanhVi_TG",
            dimension: "TG.Year",
            measure: "Behavior.TotalRevenue"
          }),
          getDimensionMembers({
            factGroup: "HanhVi",
            cube: "HanhVi_KH",
            dimension: "KH.Type",
            measure: "Behavior.TotalRevenue"
          }),
          getDimensionMembers({
            factGroup: "HanhVi",
            cube: "HanhVi_KH",
            dimension: "DD.State",
            measure: "Behavior.TotalRevenue"
          }),
          getDimensionMembers({
            factGroup: "HanhVi",
            cube: "HanhVi_KH",
            dimension: "KH.CustomerKey",
            measure: "Behavior.TotalRevenue",
            pageSize: 200,
            maxPages: 1,
            useCache: true
          }),
          queryOlapAllPages({
            factGroup: "HanhVi",
            cube: "HanhVi_KH",
            measures: ["Behavior.TotalRevenue"],
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
            factGroup: "HanhVi",
            cube: "HanhVi_KH",
            measures: ["Behavior.TotalRevenue"],
            rows: ["KH.CustomerKey", "DD.State", "DD.City"],
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
            factGroup: "HanhVi",
            cube: "HanhVi_TG",
            measures: ["Behavior.TotalRevenue"],
            rows: ["TG.TimeKey", "TG.Year", "TG.Quarter", "TG.Month"],
            columns: [],
            filters: {},
            page: 1,
            pageSize: 500
          }, {
            pageSize: 500,
            maxPages: 200,
            useCache: true
          })
        ]);

        if (!mounted) {
          return;
        }

        const customerTypes = customerTypesResult.status === "fulfilled" ? customerTypesResult.value : [];
        const states = statesResult.status === "fulfilled" ? statesResult.value : [];
        const yearMembers = yearMembersResult.status === "fulfilled" ? yearMembersResult.value : [];
        const customerKeys = customerKeysResult.status === "fulfilled" ? customerKeysResult.value : [];
        const cityStateResponse = cityStateResult.status === "fulfilled" ? cityStateResult.value : { data: [] };
        const customerLocationResponse = customerLocationResult.status === "fulfilled" ? customerLocationResult.value : { data: [] };
        const timeKeyLookupResponse = timeKeyLookupResult.status === "fulfilled" ? timeKeyLookupResult.value : { data: [] };

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

        const nextCustomerLocationMap = {};
        (customerLocationResponse?.data || []).forEach((row) => {
          const customerKey = String(extractDimensionValue(row, ["customerkey", "khach hang"]) || "").trim();
          if (!customerKey) {
            return;
          }

          const state = extractDimensionValue(row, ["state", "bang"]) || "Unknown";
          const city = extractDimensionValue(row, ["city", "thanh pho"]) || "Unknown";

          if (!nextCustomerLocationMap[customerKey]) {
            nextCustomerLocationMap[customerKey] = {
              states: new Set(),
              cities: new Set()
            };
          }

          nextCustomerLocationMap[customerKey].states.add(String(state));
          nextCustomerLocationMap[customerKey].cities.add(String(city));
        });

        const nextFirstOrderDateLookup = {};
        (timeKeyLookupResponse?.data || []).forEach((row) => {
          const timeKey = String(extractDimensionValue(row, ["timekey", "thoi gian key"]) || "").trim();
          if (!timeKey) {
            return;
          }

          const year = Number(extractDimensionValue(row, ["year", "nam"]) || 0);
          const quarter = Number(extractDimensionValue(row, ["quarter", "quy"]) || 0);
          const month = Number(extractDimensionValue(row, ["month", "thang"]) || 0);

          if (year > 0 && quarter > 0 && month > 0) {
            nextFirstOrderDateLookup[timeKey] = { year, quarter, month };
          }
        });

        setYearOptions(yearMembers);
        setTypeOptions(customerTypes);
        setStateOptions(states);
        setAllCityOptions([...uniqueCities.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })));
        setCityStateMap(nextCityStateMap);
        setCustomerLocationMap(nextCustomerLocationMap);
        setCustomerKeyOptions(customerKeys);
        setFirstOrderDateLookup(nextFirstOrderDateLookup);
      } catch {
        // Keep option lists empty if metadata loading fails.
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
            factGroup: "HanhVi",
            cube: "HanhVi_TG",
            dimension: "TG.Quarter",
            measure: "Behavior.TotalRevenue",
            filters: quarterFilters
          }),
          getDimensionMembers({
            factGroup: "HanhVi",
            cube: "HanhVi_TG",
            dimension: "TG.Month",
            measure: "Behavior.TotalRevenue",
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
    setSelectedCities((prev) => prev.filter((city) => valid.has(city)));
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
    const fallbackYears = [...new Set(allFactRows.map((row) => row.firstOrderYear).filter((year) => Number(year) > 0))]
      .sort((a, b) => Number(a) - Number(b))
      .map((value) => ({ value: String(value), label: String(value) }));
    if (fallbackYears.length > 0) setYearOptions(fallbackYears);
  }, [allFactRows, yearOptions.length]);

  useEffect(() => {
    if (!latestYear) return;
    setSelectedYears((prev) => (prev.length > 0 ? prev : [latestYear]));
    setAppliedFilters((prev) => (prev.years.length > 0 ? prev : { ...prev, years: [latestYear] }));
  }, [latestYear]);

  useEffect(() => {
    if (customerKeyOptions.length > 0) return;
    const fallback = [...new Set(allFactRows.map((row) => String(row.customerKey || "")).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      .map((value) => ({ value, label: value }));
    if (fallback.length > 0) setCustomerKeyOptions(fallback);
  }, [allFactRows, customerKeyOptions.length]);

  const visibleCustomerKeyOptions = useMemo(() => {
    if (selectedStates.length === 0 && selectedCities.length === 0) return customerKeyOptions;
    return customerKeyOptions.filter((option) => {
      const location = customerLocationMap[option.value];
      if (!location) return false;
      const matchedState = selectedStates.length === 0 || selectedStates.some((state) => location.states.has(state));
      const matchedCity = selectedCities.length === 0 || selectedCities.some((city) => location.cities.has(city));
      return matchedState && matchedCity;
    });
  }, [customerKeyOptions, customerLocationMap, selectedCities, selectedStates]);

  useEffect(() => {
    const valid = new Set(visibleCustomerKeyOptions.map((item) => item.value));
    setSelectedCustomerKeys((prev) => prev.filter((key) => valid.has(key)));
  }, [visibleCustomerKeyOptions]);

  useEffect(() => {
    let mounted = true;

    async function loadFirstOrderTimeKeys() {
      const hasTimeSelection = appliedFilters.years.length > 0
        || appliedFilters.quarters.length > 0
        || appliedFilters.months.length > 0;

      if (!hasTimeSelection) {
        if (mounted) {
          setFirstOrderDateFilterValues([]);
        }
        return;
      }

      const timeFilters = [];
      if (appliedFilters.years.length > 0) {
        timeFilters.push({ key: "TG.Year", values: appliedFilters.years });
      }
      if (appliedFilters.quarters.length > 0) {
        timeFilters.push({ key: "TG.Quarter", values: appliedFilters.quarters });
      }
      if (appliedFilters.months.length > 0) {
        timeFilters.push({ key: "TG.Month", values: appliedFilters.months });
      }

      try {
        const response = await queryOlapAllPages({
          factGroup: "HanhVi",
          cube: "HanhVi_TG",
          measures: ["Behavior.TotalRevenue"],
          rows: ["TG.TimeKey"],
          columns: [],
          filters: timeFilters,
          page: 1,
          pageSize: 500
        }, {
          pageSize: 500,
          maxPages: 200,
          useCache: true
        });

        if (!mounted) {
          return;
        }

        const values = [...new Set((response?.data || [])
          .map((row) => String(extractDimensionValue(row, ["timekey", "thoi gian key"]) || "").trim())
          .filter(Boolean))];

        setFirstOrderDateFilterValues(values);
      } catch {
        if (mounted) {
          setFirstOrderDateFilterValues([]);
        }
      }
    }

    loadFirstOrderTimeKeys();
    return () => {
      mounted = false;
    };
  }, [appliedFilters.months, appliedFilters.quarters, appliedFilters.years]);

  const measureRanges = useMemo(() => {
    const ranges = {};

    if (appliedFilters.totalItemsMin !== "" || appliedFilters.totalItemsMax !== "") {
      ranges["Behavior.TotalItems"] = {
        min: appliedFilters.totalItemsMin === "" ? null : Number(appliedFilters.totalItemsMin),
        max: appliedFilters.totalItemsMax === "" ? null : Number(appliedFilters.totalItemsMax)
      };
    }

    if (appliedFilters.totalRevenueMin !== "" || appliedFilters.totalRevenueMax !== "") {
      ranges["Behavior.TotalRevenue"] = {
        min: appliedFilters.totalRevenueMin === "" ? null : Number(appliedFilters.totalRevenueMin),
        max: appliedFilters.totalRevenueMax === "" ? null : Number(appliedFilters.totalRevenueMax)
      };
    }

    return ranges;
  }, [appliedFilters.totalItemsMax, appliedFilters.totalItemsMin, appliedFilters.totalRevenueMax, appliedFilters.totalRevenueMin]);

  const customerFilters = useMemo(() => {
    const next = [];

    if (firstOrderDateFilterValues.length > 0) {
      next.push({ key: "KH.FirstOrderDate", values: firstOrderDateFilterValues });
    }

    if (appliedFilters.types.length > 0) {
      next.push({ key: "KH.Type", values: appliedFilters.types });
    }

    if (appliedFilters.states.length > 0) {
      next.push({ key: "DD.State", values: appliedFilters.states });
    }

    if (appliedFilters.cities.length > 0) {
      next.push({ key: "DD.City", values: appliedFilters.cities });
    }

    if (appliedFilters.customerKeys.length > 0) {
      next.push({ key: "KH.CustomerKey", values: appliedFilters.customerKeys });
    }

    return next;
  }, [appliedFilters, firstOrderDateFilterValues]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const customerResponse = await queryOlapAllPages({
          factGroup: "HanhVi",
          cube: "HanhVi_KH",
          measures: ["Behavior.TotalRevenue", "Behavior.TotalItems", "Behavior.AvgOrderValue"],
          rows: ["KH.CustomerKey", "KH.Name", "KH.Type", "KH.FirstOrderDate", "DD.State", "DD.City"],
          columns: [],
          filters: customerFilters,
          measureRanges,
          page: 1,
          pageSize: FACT_PAGE_SIZE
        }, {
          pageSize: FACT_PAGE_SIZE,
          maxPages: 200,
          useCache: true
        });

        if (!mounted) {
          return;
        }

        const normalizedFactRows = (customerResponse.data || []).map((row) => {
          const firstOrderDateKey = extractDimensionValue(row, ["firstorderdate", "ngay dat", "date"]) || "N/A";
          const mappedDateParts = firstOrderDateLookup[String(firstOrderDateKey)] || null;
          const dateParts = mappedDateParts || parseDateParts(firstOrderDateKey);
          const firstOrderDateLabel = dateParts
            ? buildTimeLabel("TG.Month", dateParts.year, dateParts.quarter, dateParts.month)
            : "Unknown";

          return {
            customerKey: extractDimensionValue(row, ["customerkey", "khach hang"]) || "Unknown",
            customerName: extractDimensionValue(row, ["name", "ten"]) || "N/A",
            customerType: extractDimensionValue(row, ["type", "loai"]) || "Unknown",
            firstOrderDateKey,
            firstOrderDate: firstOrderDateLabel,
            firstOrderYear: dateParts?.year ?? null,
            firstOrderQuarter: dateParts?.quarter ?? null,
            firstOrderMonth: dateParts?.month ?? null,
            state: extractDimensionValue(row, ["state", "bang"]) || "Unknown",
            city: extractDimensionValue(row, ["city", "thanh pho"]) || "Unknown",
            totalItems: extractMeasureByName(row, "Behavior.TotalItems"),
            totalRevenue: extractMeasureByName(row, "Behavior.TotalRevenue"),
            avgOrderValue: extractMeasureByName(row, "Behavior.AvgOrderValue")
          };
        });

        setAllFactRows(normalizedFactRows);
      } catch (err) {
        if (mounted) {
          setError(err.message || "Failed to load customer behavior data.");
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
  }, [customerFilters, firstOrderDateLookup, measureRanges]);

  function applyFilters() {
    setAppliedFilters({
      years: [...selectedYears],
      quarters: [...selectedQuarters],
      months: [...selectedMonths],
      types: [...selectedTypes],
      states: [...selectedStates],
      cities: [...selectedCities],
      customerKeys: [...selectedCustomerKeys],
      totalItemsMin: totalItemsRange.min,
      totalItemsMax: totalItemsRange.max,
      totalRevenueMin: totalRevenueRange.min,
      totalRevenueMax: totalRevenueRange.max
    });
  }

  function resetFilters() {
    const defaultYears = latestYear ? [latestYear] : [];

    setSelectedYears(defaultYears);
    setSelectedQuarters([]);
    setSelectedMonths([]);
    setSelectedTypes([]);
    setSelectedStates([]);
    setSelectedCities([]);
    setSelectedCustomerKeys([]);
    setTotalItemsRange({ min: "", max: "" });
    setTotalRevenueRange({ min: "", max: "" });

    setAppliedFilters({
      years: [...defaultYears],
      quarters: [],
      months: [],
      types: [],
      states: [],
      cities: [],
      customerKeys: [],
      totalItemsMin: "",
      totalItemsMax: "",
      totalRevenueMin: "",
      totalRevenueMax: ""
    });
  }

  const filteredFactRows = useMemo(() => allFactRows, [allFactRows]);

  const timeSeriesData = useMemo(() => buildTimeSeriesByLevel(filteredFactRows, {
    level: timeLevel.key,
    getYear: (row) => row.firstOrderYear,
    getQuarter: (row) => row.firstOrderQuarter,
    getMonth: (row) => row.firstOrderMonth,
    getValue: (row) => row.totalItems
  }), [filteredFactRows, timeLevel.key]);

  const timeTableData = useMemo(() => {
    if (timeSeriesData.mode === "year") {
      if (isPivotUsersBuyTime) {
        return {
          headers: ["Metric", ...timeSeriesData.years],
          rows: [["Total Items", ...timeSeriesData.seriesByYear.map((item) => formatNumber(item.values[0] || 0))]]
        };
      }

      return {
        headers: ["Year", "Total Items"],
        rows: timeSeriesData.seriesByYear.map((item) => [item.year, formatNumber(item.values[0] || 0)])
      };
    }

    if (isPivotUsersBuyTime) {
      return {
        headers: [timeLevel.label, ...timeSeriesData.years],
        rows: timeSeriesData.buckets.map((bucket, bucketIdx) => [
          bucket,
          ...timeSeriesData.seriesByYear.map((item) => formatNumber(item.values[bucketIdx] || 0))
        ])
      };
    }

    return {
      headers: ["Year", ...timeSeriesData.buckets],
      rows: timeSeriesData.seriesByYear.map((item) => [
        item.year,
        ...item.values.map((value) => formatNumber(value))
      ])
    };
  }, [isPivotUsersBuyTime, timeLevel.label, timeSeriesData]);

  const totals = useMemo(() => ({
    buyers: new Set(filteredFactRows.map((row) => row.customerKey)).size,
    purchases: filteredFactRows.reduce((sum, row) => sum + row.totalItems, 0),
    avgValue: filteredFactRows.length > 0
      ? filteredFactRows.reduce((sum, row) => sum + row.avgOrderValue, 0) / filteredFactRows.length
      : 0
  }), [filteredFactRows]);

  const sortedFactRows = useMemo(
    () => [...filteredFactRows].sort((a, b) => b.totalRevenue - a.totalRevenue),
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
    setExpandedRowKeys([]);
  }, [
    customerFilters,
    appliedFilters,
    timeLevelIndex
  ]);

  useEffect(() => {
    setTablePage((previous) => Math.min(previous, totalTablePages));
  }, [totalTablePages]);

  const topUsersByRevenueRows = useMemo(() => {
    const map = new Map();

    filteredFactRows.forEach((item) => {
      const normalizedKey = String(item.customerKey || "").trim().toLowerCase();
      const safeKey = normalizedKey || String(item.customerKey || "Unknown");

      if (!map.has(safeKey)) {
        map.set(safeKey, {
          label: item.customerKey || "Unknown",
          customerName: item.customerName || "N/A",
          value: 0
        });
      }

      map.get(safeKey).value += item.totalRevenue;
    });

    return [...map.values()]
      .map((item) => ({ ...item, shortLabel: truncateMiddle(item.label, 22, 8, 6) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [filteredFactRows]);

  const purchasesByRegionTypeRows = useMemo(() => {
    const map = new Map();

    filteredFactRows.forEach((item) => {
      const locationLabel = locationLevel.key === "DD.City"
        ? (item.city || "Unknown")
        : (item.state || "Unknown");

      if (!map.has(locationLabel)) {
        map.set(locationLabel, { tourist: 0, postal: 0 });
      }

      const current = map.get(locationLabel);
      const type = String(item.customerType || "").toLowerCase();
      if (type.includes("tour")) {
        current.tourist += item.totalItems;
      } else {
        current.postal += item.totalItems;
      }
    });

    return [...map.entries()]
      .map(([label, value]) => ({ label, ...value }))
      .sort((a, b) => (b.tourist + b.postal) - (a.tourist + a.postal))
      .slice(0, 12);
  }, [filteredFactRows, locationLevel.key]);

  const customerTypeDistributionRows = useMemo(() => {
    const typeMap = new Map();

    filteredFactRows.forEach((item) => {
      const type = item.customerType || "Unknown";
      if (!typeMap.has(type)) {
        typeMap.set(type, new Set());
      }
      typeMap.get(type).add(item.customerKey);
    });

    return [...typeMap.entries()]
      .map(([label, set]) => ({ label, value: set.size }))
      .sort((a, b) => b.value - a.value);
  }, [filteredFactRows]);

  function toggleExpandedRow(rowKey) {
    setExpandedRowKeys((previous) => {
      if (previous.includes(rowKey)) {
        return [];
      }
      return [rowKey];
    });
  }

  const visibleMeasureSet = useMemo(() => {
    if (visibleMeasureColumns.length === 0) {
      return new Set(MEASURE_COLUMNS.map((item) => item.key));
    }
    return new Set(visibleMeasureColumns);
  }, [visibleMeasureColumns]);

  const topUsersByRevenueOption = useMemo(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { top: 20, left: 130, right: 12, bottom: 24 },
    xAxis: { type: "value", axisLabel: { formatter: formatAxisCurrency } },
    yAxis: { type: "category", data: topUsersByRevenueRows.map((item) => item.shortLabel), axisLabel: { fontSize: 10 } },
    series: [{ type: "bar", data: topUsersByRevenueRows.map((item) => item.value), itemStyle: { color: "#1456a0", borderRadius: [0, 6, 6, 0] } }]
  }), [topUsersByRevenueRows]);

  const purchasesByRegionTypeOption = useMemo(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { top: 0 },
    grid: { top: 40, left: 36, right: 12, bottom: 72 },
    xAxis: { type: "category", data: purchasesByRegionTypeRows.map((item) => truncateMiddle(item.label, 14, 6, 4)), axisLabel: { rotate: 24 } },
    yAxis: { type: "value", axisLabel: { formatter: (value) => formatNumber(value) } },
    series: [
      { name: "Tourist", type: "bar", data: purchasesByRegionTypeRows.map((item) => item.tourist), itemStyle: { color: "#dc2626" } },
      { name: "Postal", type: "bar", data: purchasesByRegionTypeRows.map((item) => item.postal), itemStyle: { color: "#2563eb" } }
    ]
  }), [purchasesByRegionTypeRows]);

  const customerTypeDistributionOption = useMemo(() => ({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0 },
    series: [{
      type: "pie",
      radius: ["35%", "70%"],
      center: ["50%", "46%"],
      data: customerTypeDistributionRows.map((item) => ({ name: item.label, value: item.value })),
      itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 1 }
    }]
  }), [customerTypeDistributionRows]);

  const usersBuyOverTimeOption = useMemo(() => {
    if (timeSeriesData.mode === "year") {
      if (isPivotUsersBuyTime) {
        return {
          tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
          grid: { top: 24, left: 130, right: 12, bottom: 26 },
          xAxis: { type: "value", axisLabel: { formatter: (value) => formatNumber(value) } },
          yAxis: { type: "category", data: timeSeriesData.years },
          series: [{ type: "bar", data: timeSeriesData.seriesByYear.map((item) => item.values[0] || 0), itemStyle: { color: "#0f766e", borderRadius: [0, 6, 6, 0] } }]
        };
      }

      return {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: timeSeriesData.years },
        yAxis: { type: "value", axisLabel: { formatter: (value) => formatNumber(value) } },
        series: [{ type: "bar", data: timeSeriesData.seriesByYear.map((item) => item.values[0] || 0), itemStyle: { color: "#0f766e" } }]
      };
    }

    if (isPivotUsersBuyTime) {
      const pivotValues = timeSeriesData.buckets.map((_, bucketIdx) => (
        timeSeriesData.seriesByYear.reduce((sum, yearSeries) => sum + (yearSeries.values[bucketIdx] || 0), 0)
      ));

      return {
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        grid: { top: 24, left: 20, right: 12, bottom: 82 },
        xAxis: { type: "category", data: timeSeriesData.buckets, axisLabel: { rotate: 24 } },
        yAxis: { type: "value", axisLabel: { formatter: (value) => formatNumber(value) } },
        series: [{ type: "bar", data: pivotValues, itemStyle: { color: "#0f766e" } }]
      };
    }

    return {
      tooltip: { trigger: "axis" },
      legend: { top: 0, data: timeSeriesData.seriesByYear.map((item) => `Year ${item.year}`) },
      grid: { top: 40, left: 36, right: 12, bottom: 42 },
      xAxis: { type: "category", data: timeSeriesData.buckets },
      yAxis: { type: "value", axisLabel: { formatter: (value) => formatNumber(value) } },
      series: timeSeriesData.seriesByYear.map((item) => ({
        name: `Year ${item.year}`,
        type: "line",
        smooth: true,
        data: item.values
      }))
    };
  }, [isPivotUsersBuyTime, timeSeriesData]);

  return (
    <section className="customer-page olap-page">
      <header className="olap-header">
        <h1>Customer Behavior</h1>
        <p>Behavior insights with time hierarchy filters.</p>
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
              <p>Total Buyers</p>
              <h3>{formatNumber(totals.buyers)}</h3>
            </article>
            <article className="olap-kpi">
              <p>Total Purchases</p>
              <h3>{formatNumber(totals.purchases)}</h3>
            </article>
            <article className="olap-kpi">
              <p>Average Purchase Value</p>
              <h3>{formatCurrencyUSD(totals.avgValue)}</h3>
            </article>
          </section>

          {error ? <p className="empty-message">{error}</p> : null}

          <section className="olap-charts">
            <article className="olap-chart-card">
              <div className="olap-chart-card__head">
                <h4>Top Customers by Revenue</h4>
              </div>
              <ReactECharts notMerge={true} option={topUsersByRevenueOption} style={{ height: "300px" }} />
              <ChartDataTable
                headers={["Customer Key", "Revenue"]}
                rows={topUsersByRevenueRows.map((item) => [item.label, formatCurrencyUSD(item.value)])}
              />
            </article>

            <article className="olap-chart-card">
              <div className="olap-chart-card__head">
                <h4>Purchases by Location</h4>
              </div>
              <ReactECharts notMerge={true} option={purchasesByRegionTypeOption} style={{ height: "300px" }} />
              <ChartDataTable
                headers={[locationLevel.label, "Tourist", "Postal"]}
                rows={purchasesByRegionTypeRows.map((item) => [item.label, formatNumber(item.tourist), formatNumber(item.postal)])}
              />
            </article>

            <article className="olap-chart-card">
              <div className="olap-chart-card__head">
                <h4>Customer Type Mix</h4>
              </div>
              <ReactECharts notMerge={true} option={customerTypeDistributionOption} style={{ height: "300px" }} />
              <ChartDataTable
                headers={["Customer Type", "Customers"]}
                rows={customerTypeDistributionRows.map((item) => [item.label, formatNumber(item.value)])}
              />
            </article>

            <article className="olap-chart-card">
              <div className="olap-chart-card__head">
                <h4>Customer Activity Over Time</h4>
                <button type="button" className="pivot-btn" onClick={() => setIsPivotUsersBuyTime((previous) => !previous)}>Pivot</button>
              </div>
              <ReactECharts notMerge={true} option={usersBuyOverTimeOption} style={{ height: "300px" }} />
              <ChartDataTable
                headers={timeTableData.headers}
                rows={timeTableData.rows}
              />
            </article>
          </section>

          <section className="olap-card">
            <h3 className="olap-card__title">Fact Rows</h3>
            <div className="fact-table-wrap">
              <table className="fact-table">
                <thead>
                  <tr>
                    <th style={{ width: "1%" }} />
                    <th>Customer Name</th>
                    <th>State</th>
                    <th>City</th>
                    {visibleMeasureSet.has("totalItems") ? <th className="num">Total Items</th> : null}
                    {visibleMeasureSet.has("totalRevenue") ? <th className="num">Revenue ($)</th> : null}
                    {visibleMeasureSet.has("avgOrderValue") ? <th className="num">Average Order Value ($)</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {pagedFactRows.length > 0 ? pagedFactRows.map((row, index) => {
                    const rowKey = `${row.customerKey}-${row.firstOrderDateKey}-${row.state}-${row.city}-${index}`;
                    const isExpanded = expandedRowKeys.includes(rowKey);

                    return (
                      <Fragment key={rowKey}>
                        <tr>
                          <td>
                            <button
                              type="button"
                              className="expand-btn"
                              onClick={() => toggleExpandedRow(rowKey)}
                              aria-label={isExpanded ? "Collapse details" : "Expand details"}
                            >
                              {isExpanded ? "-" : "+"}
                            </button>
                          </td>
                          <td title={row.customerName}>
                            <button
                              type="button"
                              className="fact-key-btn"
                              onClick={() => toggleExpandedRow(rowKey)}
                            >
                              {truncateMiddle(row.customerName, 18, 7, 5)}
                            </button>
                          </td>
                          <td>{row.state}</td>
                          <td>{row.city}</td>
                          {visibleMeasureSet.has("totalItems") ? <td className="num">{formatNumber(row.totalItems)}</td> : null}
                          {visibleMeasureSet.has("totalRevenue") ? <td className="num">{formatCurrencyUSD(row.totalRevenue)}</td> : null}
                          {visibleMeasureSet.has("avgOrderValue") ? <td className="num">{formatCurrencyUSD(row.avgOrderValue)}</td> : null}
                        </tr>
                        {isExpanded ? (
                          <tr className="expand-detail">
                            <td colSpan={4 + [...visibleMeasureSet].length}>
                              <div className="expand-detail__grid">
                                <div className="expand-detail__item">
                                  <span>Customer Name</span>
                                  <strong>{row.customerName}</strong>
                                </div>
                                <div className="expand-detail__item">
                                  <span>Customer Type</span>
                                  <strong>{row.customerType}</strong>
                                </div>
                                <div className="expand-detail__item">
                                  <span>First Order Date</span>
                                  <strong>{row.firstOrderDate}</strong>
                                </div>
                                <div className="expand-detail__item">
                                  <span>State / City</span>
                                  <strong>{`${row.state} / ${row.city}`}</strong>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  }) : (
                    <tr>
                      <td colSpan={4 + [...visibleMeasureSet].length} className="empty-message">No data available.</td>
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
            <p className="olap-panel-group__title">Time Hierarchy Members</p>
            <MultiSelect label="Year" values={selectedYears} options={yearOptions} onChange={setSelectedYears} />
            {timeLevelIndex >= 1 ? (
              <MultiSelect label="Quarter" values={selectedQuarters} options={quarterOptions} onChange={setSelectedQuarters} />
            ) : null}
            {timeLevelIndex >= 2 ? (
              <MultiSelect label="Month" values={selectedMonths} options={monthOptions} onChange={setSelectedMonths} />
            ) : null}
          </div>

          <div className="olap-panel-group">
            <p className="olap-panel-group__title">Customer Dimensions</p>
            <MultiSelect label="Customer Type" values={selectedTypes} options={typeOptions} onChange={setSelectedTypes} />
            <MultiSelect label="State" values={selectedStates} options={stateOptions} onChange={setSelectedStates} />
            <MultiSelect label="City" values={selectedCities} options={cityOptions} onChange={setSelectedCities} />
            <MultiSelect label="Customer Key" values={selectedCustomerKeys} options={visibleCustomerKeyOptions} onChange={setSelectedCustomerKeys} />
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
                Total Items Min
                <input
                  type="number"
                  value={totalItemsRange.min}
                  onChange={(event) => setTotalItemsRange((prev) => ({ ...prev, min: event.target.value }))}
                />
              </label>
              <label>
                Total Items Max
                <input
                  type="number"
                  value={totalItemsRange.max}
                  onChange={(event) => setTotalItemsRange((prev) => ({ ...prev, max: event.target.value }))}
                />
              </label>
            </div>
            <div className="metric-range">
              <label>
                Revenue Min
                <input
                  type="number"
                  value={totalRevenueRange.min}
                  onChange={(event) => setTotalRevenueRange((prev) => ({ ...prev, min: event.target.value }))}
                />
              </label>
              <label>
                Revenue Max
                <input
                  type="number"
                  value={totalRevenueRange.max}
                  onChange={(event) => setTotalRevenueRange((prev) => ({ ...prev, max: event.target.value }))}
                />
              </label>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
