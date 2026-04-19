import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  formatAxisCurrency,
  formatCurrencyUSD,
  formatNumber,
  getLatestMember,
  sortDimensionLabel,
  truncateMiddle
} from "../olap-helpers";
import "./dashboard.css";

function parseYearMember(raw) {
  const text = String(raw || "").trim();
  const yearMatch = text.match(/(19|20)\d{2}/);
  if (yearMatch) return Number(yearMatch[0]);
  const numberMatch = text.match(/\d+/);
  return numberMatch ? Number(numberMatch[0]) : null;
}

function parseQuarterMember(raw) {
  const text = String(raw || "").trim();
  const quarterMatch = text.match(/q\s*([1-4])/i);
  if (quarterMatch) return Number(quarterMatch[1]);

  const compact = text.replace(/\s+/g, "");
  if (/^[1-4]$/.test(compact)) {
    return Number(compact);
  }

  return null;
}

function parseMonthMember(raw) {
  const text = String(raw || "").trim();
  const numberMatch = text.match(/\d{1,2}/);
  if (!numberMatch) return null;
  const month = Number(numberMatch[0]);
  return month >= 1 && month <= 12 ? month : null;
}

function isValidTimeParts(year, quarter, month) {
  return Number.isFinite(year)
    && Number.isFinite(quarter)
    && Number.isFinite(month)
    && year > 0
    && quarter >= 1 && quarter <= 4
    && month >= 1 && month <= 12;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [isPivotRevenueTime, setIsPivotRevenueTime] = useState(false);

  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedQuarters, setSelectedQuarters] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [kpis, setKpis] = useState({ revenue: 0, quantity: 0, inventoryQty: 0 });
  const [salesRows, setSalesRows] = useState([]);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [customerRows, setCustomerRows] = useState([]);

  const [yearOptions, setYearOptions] = useState([]);
  const [quarterOptions, setQuarterOptions] = useState([]);
  const [monthOptions, setMonthOptions] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [salesYearValues, setSalesYearValues] = useState([]);
  const [inventoryYearValues, setInventoryYearValues] = useState([]);
  const [behaviorTimeKeys, setBehaviorTimeKeys] = useState([]);

  const [appliedFilters, setAppliedFilters] = useState({
    years: [],
    quarters: [],
    months: [],
    states: [],
    cities: []
  });

  const defaultYear = useMemo(() => {
    if (salesYearValues.length === 0 || inventoryYearValues.length === 0) {
      return "";
    }

    const inventorySet = new Set(inventoryYearValues);
    const overlap = salesYearValues.filter((year) => inventorySet.has(year));

    if (overlap.length === 0) {
      return "";
    }

    return getLatestMember(overlap.map((value) => ({ value, label: value })));
  }, [inventoryYearValues, salesYearValues]);

  // Load year/state options on mount.
  useEffect(() => {
    let mounted = true;

    async function loadOptions() {
      try {
        const [salesYearsResult, inventoryYearsResult, behaviorStatesResult, inventoryStatesResult] = await Promise.allSettled([
          getDimensionMembers({
            factGroup: "BanHang",
            cube: "BanHang_MH_TG",
            dimension: "TG.Year",
            measure: "Sales.Amount"
          }),
          getDimensionMembers({
            factGroup: "TonKho",
            cube: "TonKho",
            dimension: "TG.Year",
            measure: "Inventory.Quantity"
          }),
          getDimensionMembers({
            factGroup: "HanhVi",
            cube: "HanhVi_KH",
            dimension: "DD.State",
            measure: "Behavior.TotalRevenue"
          }),
          getDimensionMembers({
            factGroup: "TonKho",
            cube: "TonKho",
            dimension: "DD.State",
            measure: "Inventory.Quantity"
          })
        ]);

        if (!mounted) return;

        const salesYears = salesYearsResult.status === "fulfilled" ? salesYearsResult.value : [];
        const inventoryYears = inventoryYearsResult.status === "fulfilled" ? inventoryYearsResult.value : [];
        const behaviorStates = behaviorStatesResult.status === "fulfilled" ? behaviorStatesResult.value : [];
        const inventoryStates = inventoryStatesResult.status === "fulfilled" ? inventoryStatesResult.value : [];

        const mergedYearsMap = new Map([...salesYears, ...inventoryYears].map((item) => [item.value, item.label]));
        const mergedYears = [...mergedYearsMap.keys()]
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
          .map((value) => ({ value, label: mergedYearsMap.get(value) || value }));

        const mergedStatesMap = new Map([...behaviorStates, ...inventoryStates].map((item) => [item.value, item.label]));
        const mergedStates = [...mergedStatesMap.keys()]
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
          .map((value) => ({ value, label: mergedStatesMap.get(value) || value }));

        setYearOptions(mergedYears);
        setSalesYearValues(salesYears.map((item) => String(item.value)));
        setInventoryYearValues(inventoryYears.map((item) => String(item.value)));
        setStateOptions(mergedStates);
      } catch {
        // Keep options empty if metadata call fails.
      }
    }

    loadOptions();
    return () => { mounted = false; };
  }, []);

  // Load cities based on selected states
  useEffect(() => {
    let mounted = true;

    async function loadCities() {
      try {
        const filters = selectedStates.length > 0 ? [{ key: "DD.State", values: selectedStates }] : [];
        const [behaviorCitiesResult, inventoryCitiesResult] = await Promise.allSettled([
          getDimensionMembers({
            factGroup: "HanhVi",
            cube: "HanhVi_KH",
            dimension: "DD.City",
            measure: "Behavior.TotalRevenue",
            filters
          }),
          getDimensionMembers({
            factGroup: "TonKho",
            cube: "TonKho",
            dimension: "DD.City",
            measure: "Inventory.Quantity",
            filters
          })
        ]);

        const behaviorCities = behaviorCitiesResult.status === "fulfilled" ? behaviorCitiesResult.value : [];
        const inventoryCities = inventoryCitiesResult.status === "fulfilled" ? inventoryCitiesResult.value : [];
        const cityMap = new Map([...behaviorCities, ...inventoryCities].map((item) => [item.value, item.label]));
        const mergedCities = [...cityMap.keys()]
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
          .map((value) => ({ value, label: cityMap.get(value) || value }));

        if (!mounted) return;
        setCityOptions(mergedCities);
      } catch {
        if (mounted) setCityOptions([]);
      }
    }

    loadCities();
    return () => { mounted = false; };
  }, [selectedStates]);

  // Load dynamic quarter/month members from current selections.
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
        const [salesQuartersResult, inventoryQuartersResult, salesMonthsResult, inventoryMonthsResult] = await Promise.allSettled([
          getDimensionMembers({
            factGroup: "BanHang",
            cube: "BanHang_MH_TG",
            dimension: "TG.Quarter",
            measure: "Sales.Amount",
            filters: quarterFilters
          }),
          getDimensionMembers({
            factGroup: "TonKho",
            cube: "TonKho",
            dimension: "TG.Quarter",
            measure: "Inventory.Quantity",
            filters: quarterFilters
          }),
          getDimensionMembers({
            factGroup: "BanHang",
            cube: "BanHang_MH_TG",
            dimension: "TG.Month",
            measure: "Sales.Amount",
            filters: monthFilters
          }),
          getDimensionMembers({
            factGroup: "TonKho",
            cube: "TonKho",
            dimension: "TG.Month",
            measure: "Inventory.Quantity",
            filters: monthFilters
          })
        ]);

        const salesQuarters = salesQuartersResult.status === "fulfilled" ? salesQuartersResult.value : [];
        const inventoryQuarters = inventoryQuartersResult.status === "fulfilled" ? inventoryQuartersResult.value : [];
        const salesMonths = salesMonthsResult.status === "fulfilled" ? salesMonthsResult.value : [];
        const inventoryMonths = inventoryMonthsResult.status === "fulfilled" ? inventoryMonthsResult.value : [];

        const quarterMap = new Map([...salesQuarters, ...inventoryQuarters].map((item) => [item.value, item.label]));
        const monthMap = new Map([...salesMonths, ...inventoryMonths].map((item) => [item.value, item.label]));

        const quarters = [...quarterMap.keys()]
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
          .map((value) => ({ value, label: quarterMap.get(value) || value }));

        const months = [...monthMap.keys()]
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
          .map((value) => ({ value, label: monthMap.get(value) || value }));

        if (!mounted) return;
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
    return () => { mounted = false; };
  }, [selectedQuarters, selectedYears]);

  // Auto-select default year only when Sales and Inventory share at least one year.
  useEffect(() => {
    if (!defaultYear) return;
    setSelectedYears((prev) => (prev.length > 0 ? prev : [defaultYear]));
    setAppliedFilters((prev) => (prev.years.length > 0 ? prev : { ...prev, years: [defaultYear] }));
  }, [defaultYear]);

  // Prune cities when state options change
  useEffect(() => {
    if (selectedCities.length === 0) return;
    const valid = new Set(cityOptions.map((item) => item.value));
    setSelectedCities((prev) => prev.filter((city) => valid.has(city)));
  }, [cityOptions, selectedCities.length]);

  useEffect(() => {
    const validQuarters = new Set(quarterOptions.map((item) => item.value));
    setSelectedQuarters((previous) => previous.filter((quarter) => validQuarters.has(quarter)));
  }, [quarterOptions]);

  useEffect(() => {
    const validMonths = new Set(monthOptions.map((item) => item.value));
    setSelectedMonths((previous) => previous.filter((month) => validMonths.has(month)));
  }, [monthOptions]);

  // Build filters for queries
  const timeFilters = useMemo(() => {
    const filters = [];
    if (appliedFilters.years.length > 0) filters.push({ key: "TG.Year", values: appliedFilters.years });
    if (appliedFilters.quarters.length > 0) filters.push({ key: "TG.Quarter", values: appliedFilters.quarters });
    if (appliedFilters.months.length > 0) filters.push({ key: "TG.Month", values: appliedFilters.months });
    return filters;
  }, [appliedFilters.months, appliedFilters.quarters, appliedFilters.years]);

  const locationFilters = useMemo(() => {
    const filters = [];
    if (appliedFilters.states.length > 0) filters.push({ key: "DD.State", values: appliedFilters.states });
    if (appliedFilters.cities.length > 0) filters.push({ key: "DD.City", values: appliedFilters.cities });
    return filters;
  }, [appliedFilters.cities, appliedFilters.states]);

  const hasTimeFilterSelection = useMemo(
    () => appliedFilters.years.length > 0 || appliedFilters.quarters.length > 0 || appliedFilters.months.length > 0,
    [appliedFilters.months.length, appliedFilters.quarters.length, appliedFilters.years.length]
  );

  const salesFilters = useMemo(() => [...timeFilters], [timeFilters]);
  const inventoryFilters = useMemo(() => ([...timeFilters, ...locationFilters]), [locationFilters, timeFilters]);
  const behaviorFilters = useMemo(() => {
    const filters = [...locationFilters];

    if (!hasTimeFilterSelection) {
      return filters;
    }

    if (behaviorTimeKeys.length > 0) {
      filters.push({ key: "KH.FirstOrderDate", values: behaviorTimeKeys });
      return filters;
    }

    // Force empty result when user applies time filters but behavior cube has no matching time keys.
    filters.push({ key: "KH.FirstOrderDate", values: ["__NO_MATCH__"] });
    return filters;
  }, [behaviorTimeKeys, hasTimeFilterSelection, locationFilters]);

  useEffect(() => {
    let mounted = true;

    async function loadBehaviorTimeKeys() {
      if (!hasTimeFilterSelection) {
        if (mounted) setBehaviorTimeKeys([]);
        return;
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
        }, { pageSize: 500, maxPages: 200, useCache: false });

        if (!mounted) return;

        const keys = [...new Set((response?.data || [])
          .map((row) => String(extractDimensionValue(row, ["timekey", "thoi gian key"]) || "").trim())
          .filter(Boolean))];

        setBehaviorTimeKeys(keys);
      } catch {
        if (mounted) setBehaviorTimeKeys([]);
      }
    }

    loadBehaviorTimeKeys();
    return () => { mounted = false; };
  }, [hasTimeFilterSelection, timeFilters]);

  // Load dashboard data
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [salesResult, inventoryResult, customerResult] = await Promise.allSettled([
          queryOlapAllPages({
            factGroup: "BanHang",
            cube: "BanHang_MH_TG",
            measures: ["Sales.Amount", "Sales.Quantity"],
            rows: ["MH.ProductKey", "MH.Description", "MH.Size", "MH.Weight", "TG.Year", "TG.Quarter", "TG.Month"],
            columns: [],
            filters: salesFilters,
            page: 1,
            pageSize: 500
          }, { pageSize: 500, maxPages: 200, useCache: false }),
          queryOlapAllPages({
            factGroup: "TonKho",
            cube: "TonKho",
            measures: ["Inventory.Quantity"],
            rows: ["DD.State", "DD.City", "TG.Year", "TG.Quarter", "TG.Month"],
            columns: [],
            filters: inventoryFilters,
            page: 1,
            pageSize: 500
          }, { pageSize: 500, maxPages: 200, useCache: false }),
          queryOlapAllPages({
            factGroup: "HanhVi",
            cube: "HanhVi_KH",
            measures: ["Behavior.TotalItems"],
            rows: ["DD.State", "DD.City", "KH.CustomerKey"],
            columns: [],
            filters: behaviorFilters,
            page: 1,
            pageSize: 500
          }, { pageSize: 500, maxPages: 200, useCache: false })
        ]);

        if (!mounted) return;

        const nextErrors = [];

        if (salesResult.status === "fulfilled") {
          const normalizedSalesRows = (salesResult.value.data || []).map((row) => {
            const captions = extractDimensionCaptions(row).map((entry) => String(entry.value || "").trim());

            const productKeyRaw = captions[0] || extractDimensionValue(row, ["productkey", "mat hang"]);
            const yearRaw = captions[4] || extractDimensionValue(row, ["year", "nam"]);
            const quarterRaw = captions[5] || extractDimensionValue(row, ["quarter", "quy"]);
            const monthRaw = captions[6] || extractDimensionValue(row, ["month", "thang"]);

            return {
              productKey: productKeyRaw || "Unknown",
              year: parseYearMember(yearRaw),
              quarter: parseQuarterMember(quarterRaw),
              month: parseMonthMember(monthRaw),
              revenue: extractMeasureByName(row, "Sales.Amount"),
              quantity: extractMeasureByName(row, "Sales.Quantity")
            };
          }).filter((row) => isValidTimeParts(row.year, row.quarter, row.month));

          setSalesRows(normalizedSalesRows);
        } else {
          setSalesRows([]);
          nextErrors.push("Sales data unavailable");
        }

        if (inventoryResult.status === "fulfilled") {
          const normalizedInventoryRows = (inventoryResult.value.data || []).map((row) => {
            const captions = extractDimensionCaptions(row).map((entry) => String(entry.value || "").trim());

            const stateRaw = captions[0] || extractDimensionValue(row, ["state", "bang"]);
            const cityRaw = captions[1] || extractDimensionValue(row, ["city", "thanh pho"]);
            const yearRaw = captions[2] || extractDimensionValue(row, ["year", "nam"]);
            const quarterRaw = captions[3] || extractDimensionValue(row, ["quarter", "quy"]);
            const monthRaw = captions[4] || extractDimensionValue(row, ["month", "thang"]);

            return {
              state: stateRaw || "Unknown",
              city: cityRaw || "Unknown",
              year: parseYearMember(yearRaw),
              quarter: parseQuarterMember(quarterRaw),
              month: parseMonthMember(monthRaw),
              quantity: extractMeasureByName(row, "Inventory.Quantity")
            };
          }).filter((row) => isValidTimeParts(row.year, row.quarter, row.month));

          setInventoryRows(normalizedInventoryRows);
        } else {
          setInventoryRows([]);
          nextErrors.push("Inventory data unavailable");
        }

        if (customerResult.status === "fulfilled") {
          setCustomerRows((customerResult.value.data || []).map((row) => {
            const captions = extractDimensionCaptions(row).map((entry) => String(entry.value || "").trim());
            const stateRaw = captions[0] || extractDimensionValue(row, ["state", "bang"]);
            const customerKeyRaw = captions[2] || extractDimensionValue(row, ["customerkey", "khach hang"]);

            return {
              state: stateRaw || "Unknown",
              customerKey: customerKeyRaw || "Unknown",
              items: extractMeasureByName(row, "Behavior.TotalItems")
            };
          }));
        } else {
          setCustomerRows([]);
          nextErrors.push("Customer data unavailable");
        }

        setError(nextErrors.join(" | "));
      } catch (err) {
        if (mounted) setError(err.message || "Unable to load dashboard data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, [behaviorFilters, inventoryFilters, salesFilters]);

  function applyFilters() {
    setAppliedFilters({
      years: [...selectedYears],
      quarters: [...selectedQuarters],
      months: [...selectedMonths],
      states: [...selectedStates],
      cities: [...selectedCities]
    });
  }

  function resetFilters() {
    const defaultYears = defaultYear ? [defaultYear] : [];
    setSelectedYears(defaultYears);
    setSelectedQuarters([]);
    setSelectedMonths([]);
    setSelectedStates([]);
    setSelectedCities([]);
    setAppliedFilters({
      years: [...defaultYears],
      quarters: [],
      months: [],
      states: [],
      cities: []
    });
  }

  // ─── Computed data for charts ───
  const revenueTrendRows = useMemo(() => {
    const map = new Map();
    salesRows.forEach((row) => {
      const label = `${row.year}-Q${row.quarter}-M${row.month}`;
      map.set(label, (map.get(label) || 0) + row.revenue);
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => sortDimensionLabel(a.label, b.label));
  }, [salesRows]);

  const topRevenueProductRows = useMemo(() => {
    const map = new Map();
    salesRows.forEach((row) => {
      map.set(row.productKey, (map.get(row.productKey) || 0) + row.revenue);
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value, shortLabel: truncateMiddle(label, 18, 7, 5) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [salesRows]);

  const customerCountByStateRows = useMemo(() => {
    const customerMap = new Map();
    customerRows.forEach((row) => {
      if (!customerMap.has(row.state)) customerMap.set(row.state, new Set());
      customerMap.get(row.state).add(row.customerKey);
    });
    return [...customerMap.entries()]
      .map(([label, set]) => ({ label, value: set.size }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [customerRows]);

  const inventoryTrendRows = useMemo(() => {
    const map = new Map();
    inventoryRows.forEach((row) => {
      const key = `${row.year}|${row.quarter}|${row.month}`;
      const existing = map.get(key) || {
        year: row.year,
        quarter: row.quarter,
        month: row.month,
        value: 0
      };
      existing.value += row.quantity;
      map.set(key, existing);
    });

    return [...map.values()]
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.quarter !== b.quarter) return a.quarter - b.quarter;
        return a.month - b.month;
      })
      .map((item) => ({
        label: `${item.year}-Q${item.quarter}-M${item.month}`,
        value: item.value
      }));
  }, [inventoryRows]);

  useEffect(() => {
    setKpis({
      revenue: salesRows.reduce((sum, row) => sum + row.revenue, 0),
      quantity: salesRows.reduce((sum, row) => sum + row.quantity, 0),
      inventoryQty: inventoryRows.reduce((sum, row) => sum + row.quantity, 0)
    });
  }, [inventoryRows, salesRows]);

  // ─── Chart options ───
  const revenueTrendOption = useMemo(() => {
    if (isPivotRevenueTime) {
      return {
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        grid: { top: 24, left: 140, right: 16, bottom: 24 },
        xAxis: { type: "value", axisLabel: { formatter: formatAxisCurrency } },
        yAxis: { type: "category", data: revenueTrendRows.map((item) => item.label) },
        series: [{ type: "bar", data: revenueTrendRows.map((item) => item.value), itemStyle: { color: "#0f4c81", borderRadius: [0, 6, 6, 0] } }]
      };
    }
    return {
      tooltip: { trigger: "axis" },
      grid: { top: 24, left: 20, right: 16, bottom: 92 },
      xAxis: { type: "category", data: revenueTrendRows.map((item) => item.label), axisLabel: { rotate: 28 } },
      yAxis: { type: "value", axisLabel: { formatter: formatAxisCurrency } },
      series: [{ type: "line", smooth: true, data: revenueTrendRows.map((item) => item.value), areaStyle: {}, itemStyle: { color: "#0f4c81" } }]
    };
  }, [isPivotRevenueTime, revenueTrendRows]);

  const topRevenueProductOption = useMemo(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { top: 22, left: 120, right: 16, bottom: 22 },
    xAxis: { type: "value", axisLabel: { formatter: formatAxisCurrency } },
    yAxis: { type: "category", data: topRevenueProductRows.map((item) => item.shortLabel) },
    series: [{ type: "bar", data: topRevenueProductRows.map((item) => item.value), itemStyle: { color: "#2563eb", borderRadius: [0, 6, 6, 0] } }]
  }), [topRevenueProductRows]);

  const customerCountByStateOption = useMemo(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { top: 22, left: 120, right: 16, bottom: 22 },
    xAxis: { type: "value" },
    yAxis: { type: "category", data: customerCountByStateRows.map((item) => truncateMiddle(item.label, 16, 6, 4)) },
    series: [{ type: "bar", data: customerCountByStateRows.map((item) => item.value), itemStyle: { color: "#0f766e", borderRadius: [0, 6, 6, 0] } }]
  }), [customerCountByStateRows]);

  const inventoryTrendOption = useMemo(() => ({
    tooltip: { trigger: "axis" },
    grid: { top: 24, left: 20, right: 16, bottom: 92 },
    xAxis: { type: "category", data: inventoryTrendRows.map((item) => item.label), axisLabel: { rotate: 28 } },
    yAxis: { type: "value", axisLabel: { formatter: (value) => formatNumber(value) } },
    series: [{ type: "line", smooth: true, data: inventoryTrendRows.map((item) => item.value), areaStyle: {}, itemStyle: { color: "#a16207" } }]
  }), [inventoryTrendRows]);

  return (
    <section className="dashboard-v2-page olap-page">
      <header className="olap-header">
        <h1>Overview Dashboard</h1>
      </header>

      <section className="olap-card">
        <h3 className="olap-card__title">Filters</h3>
        <div className="dashboard-v2-filters__grid">
          <MultiSelect label="Year" values={selectedYears} options={yearOptions} onChange={setSelectedYears} />
          <MultiSelect label="Quarter" values={selectedQuarters} options={quarterOptions} onChange={setSelectedQuarters} />
          <MultiSelect label="Month" values={selectedMonths} options={monthOptions} onChange={setSelectedMonths} />
          <MultiSelect label="State" values={selectedStates} options={stateOptions} onChange={setSelectedStates} />
          <MultiSelect label="City" values={selectedCities} options={cityOptions} onChange={setSelectedCities} />
        </div>
        <div className="dashboard-v2-filters__actions">
          <button type="button" className="filter-toggle-btn" onClick={applyFilters}>Filter</button>
          <button type="button" className="filter-toggle-btn" onClick={resetFilters}>Reset</button>
        </div>
      </section>

      {error ? <p className="empty-message">{error}</p> : null}
      {loading ? <p className="empty-message">Loading dashboard data...</p> : null}

      <section className="olap-kpis">
        <article className="kpi-card">
          <p>Revenue</p>
          <h2>{formatCurrencyUSD(kpis.revenue)}</h2>
        </article>
        <article className="kpi-card">
          <p>Sold Quantity</p>
          <h2>{formatNumber(kpis.quantity)}</h2>
        </article>
        <article className="kpi-card">
          <p>Inventory Quantity</p>
          <h2>{formatNumber(kpis.inventoryQty)}</h2>
        </article>
      </section>

      <section className="olap-charts">
        <article className="mini-chart-card" onClick={() => navigate("/sale")}>
          <div className="olap-chart-card__head">
            <h4>Revenue Over Time</h4>
            <button type="button" className="pivot-btn" onClick={(event) => { event.stopPropagation(); setIsPivotRevenueTime((prev) => !prev); }}>Pivot</button>
          </div>
          <ReactECharts notMerge={true} option={revenueTrendOption} style={{ height: "300px" }} />
        </article>

        <article className="mini-chart-card" onClick={() => navigate("/sale")}>
          <h4>Top Products by Revenue</h4>
          <ReactECharts notMerge={true} option={topRevenueProductOption} style={{ height: "300px" }} />
        </article>

        {/* <article className="mini-chart-card" onClick={() => navigate("/customer")}>
          <h4>Customers by State</h4>
          <ReactECharts notMerge={true} option={customerCountByStateOption} style={{ height: "300px" }} />
        </article>

        <article className="mini-chart-card" onClick={() => navigate("/inventory")}>
          <h4>Inventory Over Time</h4>
          <ReactECharts notMerge={true} option={inventoryTrendOption} style={{ height: "300px" }} />
        </article> */}
      </section>
    </section>
  );
}
