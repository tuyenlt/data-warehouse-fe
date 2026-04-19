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
  formatAxisCurrency,
  formatCurrencyUSD,
  formatNumber,
  getLatestMember,
  truncateMiddle
} from "../olap-helpers";
import "./sale.css";

const TIME_LEVELS = [
  { label: "Year", key: "TG.Year" },
  { label: "Quarter", key: "TG.Quarter" },
  { label: "Month", key: "TG.Month" }
];

const MEASURE_COLUMNS = [
  { key: "quantity", label: "Quantity" },
  { key: "revenue", label: "Revenue ($)" },
  { key: "profit", label: "Profit ($)" },
  { key: "avgProfit", label: "Average Profit ($)" }
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

  const numberMatch = text.match(/[1-4]/);
  return numberMatch ? Number(numberMatch[0]) : null;
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

function TimeMatrix({ data, pivot, valueFormatter }) {
  if (data.mode === "year") {
    return (
      <div className="matrix-wrap">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {data.seriesByYear.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td>{valueFormatter(row.values[0] || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!pivot) {
    return (
      <div className="matrix-wrap">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Year</th>
              {data.buckets.map((bucket) => <th key={bucket}>{bucket}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.seriesByYear.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                {row.values.map((value, idx) => <td key={`${row.year}-${idx}`}>{valueFormatter(value)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="matrix-wrap">
      <table className="matrix-table">
        <thead>
          <tr>
            <th>Bucket</th>
            {data.years.map((year) => <th key={year}>{year}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.buckets.map((bucket, bucketIdx) => (
            <tr key={bucket}>
              <td>{bucket}</td>
              {data.seriesByYear.map((row) => <td key={`${bucket}-${row.year}`}>{valueFormatter(row.values[bucketIdx] || 0)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductMatrix({ rows, pivot, valueFormatter, valueHeader }) {
  if (!pivot) {
    return (
      <div className="matrix-wrap">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Product Key</th>
              <th>{valueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{valueFormatter(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="matrix-wrap">
      <table className="matrix-table">
        <thead>
          <tr>
            <th>{valueHeader}</th>
            {rows.map((row) => <th key={row.label}>{row.label}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{valueHeader}</td>
            {rows.map((row) => <td key={`${row.label}-value`}>{valueFormatter(row.value)}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function SalePage() {
  const [timeLevelIndex, setTimeLevelIndex] = useState(2);
  const [isPivotRevenueByTime, setIsPivotRevenueByTime] = useState(false);
  const [isPivotQuantityByTime, setIsPivotQuantityByTime] = useState(false);
  const [isPivotRevenueByProduct, setIsPivotRevenueByProduct] = useState(false);
  const [isPivotAvgProfitByProduct, setIsPivotAvgProfitByProduct] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedQuarters, setSelectedQuarters] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);

  const [revenueRange, setRevenueRange] = useState({ min: "", max: "" });
  const [quantityRange, setQuantityRange] = useState({ min: "", max: "" });
  const [profitRange, setProfitRange] = useState({ min: "", max: "" });

  const [visibleMeasureColumns, setVisibleMeasureColumns] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [allFactRows, setAllFactRows] = useState([]);
  const [tablePage, setTablePage] = useState(1);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  const [yearOptions, setYearOptions] = useState([]);
  const [quarterOptions, setQuarterOptions] = useState([]);
  const [monthOptions, setMonthOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);

  const [appliedFilters, setAppliedFilters] = useState({
    years: [],
    quarters: [],
    months: [],
    products: [],
    revenueMin: "",
    revenueMax: "",
    quantityMin: "",
    quantityMax: "",
    profitMin: "",
    profitMax: ""
  });

  const timeLevel = TIME_LEVELS[timeLevelIndex] ?? TIME_LEVELS[2];
  const latestYear = useMemo(() => getLatestMember(yearOptions), [yearOptions]);

  useEffect(() => {
    let mounted = true;

    async function loadOptions() {
      if (!mounted) {
        return;
      }

      try {
        const [yearsResult, productsResult] = await Promise.allSettled([
          getDimensionMembers({
            factGroup: "BanHang",
            cube: "BanHang_MH_TG",
            dimension: "TG.Year",
            measure: "Sales.Amount"
          }),
          getDimensionMembers({
            factGroup: "BanHang",
            cube: "BanHang_MH_TG",
            dimension: "MH.ProductKey",
            measure: "Sales.Amount"
          })
        ]);

        if (!mounted) {
          return;
        }

        if (yearsResult.status === "fulfilled") {
          setYearOptions(yearsResult.value);
        }

        if (productsResult.status === "fulfilled") {
          setProductOptions(productsResult.value);
        }
      } catch {
        // Keep existing options on metadata failure.
      }
    }

    loadOptions();
    return () => {
      mounted = false;
    };
  }, []);

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
            factGroup: "BanHang",
            cube: "BanHang_MH_TG",
            dimension: "TG.Quarter",
            measure: "Sales.Amount",
            filters: quarterFilters
          }),
          getDimensionMembers({
            factGroup: "BanHang",
            cube: "BanHang_MH_TG",
            dimension: "TG.Month",
            measure: "Sales.Amount",
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
    const validQuarters = new Set(quarterOptions.map((item) => item.value));
    setSelectedQuarters((previous) => previous.filter((quarter) => validQuarters.has(quarter)));
  }, [quarterOptions]);

  useEffect(() => {
    const validMonths = new Set(monthOptions.map((item) => item.value));
    setSelectedMonths((previous) => previous.filter((month) => validMonths.has(month)));
  }, [monthOptions]);

  useEffect(() => {
    if (timeLevelIndex === 0) {
      setSelectedQuarters([]);
      setSelectedMonths([]);
    }

    if (timeLevelIndex === 1) {
      setSelectedMonths([]);
    }
  }, [timeLevelIndex]);

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
    if (appliedFilters.products.length > 0) {
      next.push({ key: "MH.ProductKey", values: appliedFilters.products });
    }

    return next;
  }, [appliedFilters]);

  const measureRanges = useMemo(() => {
    const ranges = {};

    if (appliedFilters.revenueMin !== "" || appliedFilters.revenueMax !== "") {
      ranges["Sales.Amount"] = {
        min: appliedFilters.revenueMin === "" ? null : Number(appliedFilters.revenueMin),
        max: appliedFilters.revenueMax === "" ? null : Number(appliedFilters.revenueMax)
      };
    }

    if (appliedFilters.quantityMin !== "" || appliedFilters.quantityMax !== "") {
      ranges["Sales.Quantity"] = {
        min: appliedFilters.quantityMin === "" ? null : Number(appliedFilters.quantityMin),
        max: appliedFilters.quantityMax === "" ? null : Number(appliedFilters.quantityMax)
      };
    }

    if (appliedFilters.profitMin !== "" || appliedFilters.profitMax !== "") {
      ranges["Sales.Profit"] = {
        min: appliedFilters.profitMin === "" ? null : Number(appliedFilters.profitMin),
        max: appliedFilters.profitMax === "" ? null : Number(appliedFilters.profitMax)
      };
    }

    return ranges;
  }, [
    appliedFilters.profitMax,
    appliedFilters.profitMin,
    appliedFilters.quantityMax,
    appliedFilters.quantityMin,
    appliedFilters.revenueMax,
    appliedFilters.revenueMin
  ]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const response = await queryOlapAllPages({
          factGroup: "BanHang",
          cube: "BanHang_MH_TG",
          measures: ["Sales.Amount", "Sales.Quantity", "Sales.Profit", "Sales.AvgProfit"],
          rows: ["MH.ProductKey", "MH.Description", "MH.Size", "MH.Weight", "TG.Year", "TG.Quarter", "TG.Month"],
          columns: [],
          filters,
          measureRanges,
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

        const normalizedRows = (response.data || []).map((row) => {
          const captions = extractDimensionCaptions(row).map((entry) => String(entry.value || "").trim());

          const productKeyRaw = captions[0] || extractDimensionValue(row, ["productkey", "mat hang"]);
          const descriptionRaw = captions[1] || extractDimensionValue(row, ["description", "mo ta"]);
          const sizeRaw = captions[2] || extractDimensionValue(row, ["size", "kich thuoc"]);
          const productWeightRaw = captions[3] || extractDimensionValue(row, ["weight", "trong luong"]);
          const yearRaw = captions[4] || extractDimensionValue(row, ["year", "nam"]);
          const quarterRaw = captions[5] || extractDimensionValue(row, ["quarter", "quy"]);
          const monthRaw = captions[6] || extractDimensionValue(row, ["month", "thang"]);

          return {
            productKey: productKeyRaw || "Unknown",
            description: descriptionRaw || "N/A",
            size: sizeRaw || "N/A",
            productWeight: productWeightRaw || "N/A",
            year: parseYearMember(yearRaw),
            quarter: parseQuarterMember(quarterRaw),
            month: parseMonthMember(monthRaw),
            revenue: extractMeasureByName(row, "Sales.Amount"),
            quantity: extractMeasureByName(row, "Sales.Quantity"),
            profit: extractMeasureByName(row, "Sales.Profit"),
            avgProfit: extractMeasureByName(row, "Sales.AvgProfit")
          };
        }).filter((row) => isValidTimeParts(row.year, row.quarter, row.month));

        setAllFactRows(normalizedRows);
      } catch (err) {
        if (mounted) {
          setError(err.message || "Failed to load Sales data.");
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

  useEffect(() => {
    if (yearOptions.length > 0) {
      return;
    }

    const fallbackYears = [...new Set(allFactRows.map((row) => row.year).filter((year) => year > 0))]
      .sort((a, b) => a - b)
      .map((value) => ({ value: String(value), label: String(value) }));

    if (fallbackYears.length > 0) {
      setYearOptions(fallbackYears);
    }
  }, [allFactRows, yearOptions.length]);

  useEffect(() => {
    if (!latestYear) {
      return;
    }

    setSelectedYears((previous) => (previous.length > 0 ? previous : [latestYear]));
    setAppliedFilters((previous) => (previous.years.length > 0 ? previous : { ...previous, years: [latestYear] }));
  }, [latestYear]);

  useEffect(() => {
    if (productOptions.length > 0) {
      return;
    }

    const fallbackProducts = [...new Set(allFactRows.map((row) => String(row.productKey || "")).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      .map((value) => ({ value, label: value }));

    if (fallbackProducts.length > 0) {
      setProductOptions(fallbackProducts);
    }
  }, [allFactRows, productOptions.length]);

  useEffect(() => {
    const validProducts = new Set(productOptions.map((item) => item.value));
    setSelectedProducts((previous) => previous.filter((product) => validProducts.has(product)));
  }, [productOptions]);

  function applyFilters() {
    setAppliedFilters({
      years: [...selectedYears],
      quarters: [...selectedQuarters],
      months: [...selectedMonths],
      products: [...selectedProducts],
      revenueMin: revenueRange.min,
      revenueMax: revenueRange.max,
      quantityMin: quantityRange.min,
      quantityMax: quantityRange.max,
      profitMin: profitRange.min,
      profitMax: profitRange.max
    });
  }

  function resetFilters() {
    const defaultYears = latestYear ? [latestYear] : [];

    setSelectedYears(defaultYears);
    setSelectedQuarters([]);
    setSelectedMonths([]);
    setSelectedProducts([]);
    setRevenueRange({ min: "", max: "" });
    setQuantityRange({ min: "", max: "" });
    setProfitRange({ min: "", max: "" });
    setAppliedFilters({
      years: [...defaultYears],
      quarters: [],
      months: [],
      products: [],
      revenueMin: "",
      revenueMax: "",
      quantityMin: "",
      quantityMax: "",
      profitMin: "",
      profitMax: ""
    });
  }

  const filteredFactRows = useMemo(() => allFactRows, [allFactRows]);

  const totals = useMemo(() => ({
    revenue: filteredFactRows.reduce((sum, row) => sum + row.revenue, 0),
    quantity: filteredFactRows.reduce((sum, row) => sum + row.quantity, 0),
    profit: filteredFactRows.reduce((sum, row) => sum + row.profit, 0)
  }), [filteredFactRows]);

  const sortedFactRows = useMemo(
    () => [...filteredFactRows].sort((a, b) => b.revenue - a.revenue),
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
  }, [appliedFilters]);

  useEffect(() => {
    setTablePage((previous) => Math.min(previous, totalTablePages));
  }, [totalTablePages]);

  const revenueTimeData = useMemo(() => buildTimeSeriesByLevel(filteredFactRows, {
    level: timeLevel.key,
    getYear: (row) => row.year,
    getQuarter: (row) => row.quarter,
    getMonth: (row) => row.month,
    getValue: (row) => row.revenue
  }), [filteredFactRows, timeLevel.key]);

  const quantityTimeData = useMemo(() => buildTimeSeriesByLevel(filteredFactRows, {
    level: timeLevel.key,
    getYear: (row) => row.year,
    getQuarter: (row) => row.quarter,
    getMonth: (row) => row.month,
    getValue: (row) => row.quantity
  }), [filteredFactRows, timeLevel.key]);

  const productRevenueRows = useMemo(() => {
    const map = new Map();
    filteredFactRows.forEach((row) => {
      map.set(row.productKey, (map.get(row.productKey) || 0) + row.revenue);
    });

    return [...map.entries()]
      .map(([label, value]) => ({ label, value, shortLabel: truncateMiddle(label, 18, 7, 5) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [filteredFactRows]);

  const productAvgProfitRows = useMemo(() => {
    const map = new Map();

    filteredFactRows.forEach((row) => {
      if (!map.has(row.productKey)) {
        map.set(row.productKey, { sum: 0, count: 0 });
      }
      const current = map.get(row.productKey);
      current.sum += row.avgProfit;
      current.count += 1;
    });

    return [...map.entries()]
      .map(([label, value]) => ({
        label,
        value: value.count > 0 ? value.sum / value.count : 0,
        shortLabel: truncateMiddle(label, 18, 7, 5)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [filteredFactRows]);

  function toggleExpandedRow(rowKey) {
    setExpandedRowKeys((previous) => {
      if (previous.includes(rowKey)) {
        return [];
      }
      return [rowKey];
    });
  }

  function buildTimeOption(data, pivot, color, valueFormatter) {
    if (data.mode === "year") {
      const values = data.seriesByYear.map((item) => item.values[0] || 0);
      if (pivot) {
        return {
          tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
          grid: { top: 20, left: 120, right: 12, bottom: 24 },
          xAxis: { type: "value", axisLabel: { formatter: valueFormatter } },
          yAxis: { type: "category", data: data.years },
          series: [{ type: "bar", data: values, itemStyle: { color, borderRadius: [0, 6, 6, 0] } }]
        };
      }

      return {
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: data.years },
        yAxis: { type: "value", axisLabel: { formatter: valueFormatter } },
        series: [{ type: "bar", data: values, itemStyle: { color } }]
      };
    }

    if (!pivot) {
      const seriesByYear = data.seriesByYear.map((item) => ({
        name: `Year ${item.year}`,
        type: "line",
        smooth: true,
        data: item.values
      }));

      return {
        tooltip: { trigger: "axis" },
        legend: { top: 0, data: seriesByYear.map((item) => item.name) },
        grid: { top: 40, left: 36, right: 12, bottom: 42 },
        xAxis: { type: "category", data: data.buckets },
        yAxis: { type: "value", axisLabel: { formatter: valueFormatter } },
        series: seriesByYear
      };
    }

    const bucketSeries = data.buckets.map((bucket, bucketIdx) => ({
      name: bucket,
      data: data.years.map((year, yearIdx) => [data.seriesByYear[yearIdx].values[bucketIdx] || 0, year])
    }));

    return {
      tooltip: { trigger: "item" },
      legend: { top: 0, data: bucketSeries.map((item) => item.name) },
      grid: { top: 44, left: 74, right: 12, bottom: 20 },
      xAxis: { type: "value", axisLabel: { formatter: valueFormatter } },
      yAxis: { type: "category", data: data.years },
      series: bucketSeries.map((series) => ({
        name: series.name,
        type: "line",
        smooth: true,
        symbolSize: 6,
        data: series.data
      }))
    };
  }

  const revenueByTimeOption = useMemo(
    () => buildTimeOption(revenueTimeData, isPivotRevenueByTime, "#1f4f8b", formatAxisCurrency),
    [isPivotRevenueByTime, revenueTimeData]
  );

  const quantityByTimeOption = useMemo(
    () => buildTimeOption(quantityTimeData, isPivotQuantityByTime, "#0f766e", (value) => formatNumber(value)),
    [isPivotQuantityByTime, quantityTimeData]
  );

  function buildProductOption(rows, pivot, color, formatter) {
    if (pivot) {
      return {
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        grid: { top: 24, left: 24, right: 12, bottom: 88 },
        xAxis: { type: "category", data: rows.map((item) => item.shortLabel), axisLabel: { rotate: 28 } },
        yAxis: { type: "value", axisLabel: { formatter } },
        series: [{ type: "bar", data: rows.map((item) => item.value), itemStyle: { color } }]
      };
    }

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { top: 24, left: 130, right: 12, bottom: 22 },
      xAxis: { type: "value", axisLabel: { formatter } },
      yAxis: { type: "category", data: rows.map((item) => item.shortLabel), axisLabel: { fontSize: 10 } },
      series: [{ type: "bar", data: rows.map((item) => item.value), itemStyle: { color, borderRadius: [0, 6, 6, 0] } }]
    };
  }

  const revenueByProductOption = useMemo(
    () => buildProductOption(productRevenueRows, isPivotRevenueByProduct, "#1456a0", formatAxisCurrency),
    [isPivotRevenueByProduct, productRevenueRows]
  );

  const avgProfitByProductOption = useMemo(
    () => buildProductOption(productAvgProfitRows, isPivotAvgProfitByProduct, "#a16207", formatAxisCurrency),
    [isPivotAvgProfitByProduct, productAvgProfitRows]
  );

  const visibleMeasureSet = useMemo(() => {
    if (visibleMeasureColumns.length === 0) {
      return new Set(MEASURE_COLUMNS.map((item) => item.key));
    }
    return new Set(visibleMeasureColumns);
  }, [visibleMeasureColumns]);

  return (
    <section className="sale-page olap-page">
      <header className="olap-header">
        <h1>Sales Analysis</h1>
        <p>Sales metrics with chart-level pivot.</p>
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
            </div>
            {loading ? <p className="olap-loading-badge">Loading data...</p> : null}
          </section>

          <section className="olap-kpis">
            <article className="olap-kpi">
              <p>Revenue</p>
              <h3>{formatCurrencyUSD(totals.revenue)}</h3>
            </article>
            <article className="olap-kpi">
              <p>Sold Quantity</p>
              <h3>{formatNumber(totals.quantity)}</h3>
            </article>
            <article className="olap-kpi">
              <p>Profit</p>
              <h3>{formatCurrencyUSD(totals.profit)}</h3>
            </article>
          </section>

          {error ? <p className="empty-message">{error}</p> : null}

          <section className="olap-charts">
            <article className="olap-chart-card">
              <div className="olap-chart-card__head">
                <h4>Revenue Over Time</h4>
                <button type="button" className="pivot-btn" onClick={() => setIsPivotRevenueByTime((previous) => !previous)}>Pivot</button>
              </div>
              <ReactECharts notMerge={true}
                key={`sale-revenue-time-${timeLevel.key}-${isPivotRevenueByTime ? "pivot" : "base"}`}
                option={revenueByTimeOption}
                notMerge
                style={{ height: "320px" }}
              />
              <TimeMatrix data={revenueTimeData} pivot={isPivotRevenueByTime} valueFormatter={formatCurrencyUSD} />
            </article>

            <article className="olap-chart-card">
              <div className="olap-chart-card__head">
                <h4>Quantity Over Time</h4>
                <button type="button" className="pivot-btn" onClick={() => setIsPivotQuantityByTime((previous) => !previous)}>Pivot</button>
              </div>
              <ReactECharts notMerge={true}
                key={`sale-quantity-time-${timeLevel.key}-${isPivotQuantityByTime ? "pivot" : "base"}`}
                option={quantityByTimeOption}
                notMerge
                style={{ height: "320px" }}
              />
              <TimeMatrix data={quantityTimeData} pivot={isPivotQuantityByTime} valueFormatter={formatNumber} />
            </article>

            <article className="olap-chart-card">
              <div className="olap-chart-card__head">
                <h4>Revenue by Product</h4>
                <button type="button" className="pivot-btn" onClick={() => setIsPivotRevenueByProduct((previous) => !previous)}>Pivot</button>
              </div>
              <ReactECharts notMerge={true} option={revenueByProductOption} style={{ height: "320px" }} />
              <ProductMatrix
                rows={productRevenueRows}
                pivot={isPivotRevenueByProduct}
                valueFormatter={formatCurrencyUSD}
                valueHeader="Revenue"
              />
            </article>

            <article className="olap-chart-card">
              <div className="olap-chart-card__head">
                <h4>Avg Profit by Product</h4>
                <button type="button" className="pivot-btn" onClick={() => setIsPivotAvgProfitByProduct((previous) => !previous)}>Pivot</button>
              </div>
              <ReactECharts notMerge={true} option={avgProfitByProductOption} style={{ height: "320px" }} />
              <ProductMatrix
                rows={productAvgProfitRows}
                pivot={isPivotAvgProfitByProduct}
                valueFormatter={formatCurrencyUSD}
                valueHeader="Average Profit"
              />
            </article>
          </section>

          <section className="olap-card">
            <h3 className="olap-card__title">Fact Rows</h3>
            <div className="fact-table-wrap">
              <table className="fact-table">
                <thead>
                  <tr>
                    <th>Product Key</th>
                    <th>Year</th>
                    <th>Quarter</th>
                    <th>Month</th>
                    {visibleMeasureSet.has("quantity") ? <th className="num">Quantity</th> : null}
                    {visibleMeasureSet.has("revenue") ? <th className="num">Revenue ($)</th> : null}
                    {visibleMeasureSet.has("profit") ? <th className="num">Profit ($)</th> : null}
                    {visibleMeasureSet.has("avgProfit") ? <th className="num">Average Profit ($)</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {pagedFactRows.length > 0 ? pagedFactRows.map((row, index) => {
                    const rowKey = `${row.productKey}-${row.year}-${row.quarter}-${row.month}-${index}`;
                    const isExpanded = expandedRowKeys.includes(rowKey);

                    return (
                      <Fragment key={rowKey}>
                        <tr>
                          <td title={row.productKey}>
                            <div className="fact-key-inline">
                              <span className="fact-key-text">{row.productKey}</span>
                              <button
                                type="button"
                                className="expand-btn fact-key-plus"
                                onClick={() => toggleExpandedRow(rowKey)}
                                aria-label={isExpanded ? "Collapse details" : "Expand details"}
                              >
                                {isExpanded ? "-" : "+"}
                              </button>
                            </div>
                          </td>
                          <td>{row.year}</td>
                          <td>{`Q${row.quarter}`}</td>
                          <td>{`M${row.month}`}</td>
                          {visibleMeasureSet.has("quantity") ? <td className="num">{formatNumber(row.quantity)}</td> : null}
                          {visibleMeasureSet.has("revenue") ? <td className="num">{formatCurrencyUSD(row.revenue)}</td> : null}
                          {visibleMeasureSet.has("profit") ? <td className="num">{formatCurrencyUSD(row.profit)}</td> : null}
                          {visibleMeasureSet.has("avgProfit") ? <td className="num">{formatCurrencyUSD(row.avgProfit)}</td> : null}
                        </tr>
                        {isExpanded ? (
                          <tr className="expand-detail">
                            <td colSpan={4 + [...visibleMeasureSet].length}>
                              <div className="expand-detail__grid">
                                <div className="expand-detail__item">
                                  <span>Description</span>
                                  <strong>{row.description}</strong>
                                </div>
                                <div className="expand-detail__item">
                                  <span>Size</span>
                                  <strong>{row.size}</strong>
                                </div>
                                <div className="expand-detail__item">
                                  <span>Product Weight</span>
                                  <strong>{row.productWeight}</strong>
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
            <p className="olap-panel-group__title">Hierarchy Members</p>
            <MultiSelect label="Year" values={selectedYears} options={yearOptions} onChange={setSelectedYears} />
            {timeLevelIndex >= 1 ? (
              <MultiSelect label="Quarter" values={selectedQuarters} options={quarterOptions} onChange={setSelectedQuarters} />
            ) : null}
            {timeLevelIndex >= 2 ? (
              <MultiSelect label="Month" values={selectedMonths} options={monthOptions} onChange={setSelectedMonths} />
            ) : null}
            <MultiSelect label="Product Key" values={selectedProducts} options={productOptions} onChange={setSelectedProducts} />
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
                Revenue Min
                <input
                  type="number"
                  value={revenueRange.min}
                  onChange={(event) => setRevenueRange((prev) => ({ ...prev, min: event.target.value }))}
                />
              </label>
              <label>
                Revenue Max
                <input
                  type="number"
                  value={revenueRange.max}
                  onChange={(event) => setRevenueRange((prev) => ({ ...prev, max: event.target.value }))}
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
                Profit Min
                <input
                  type="number"
                  value={profitRange.min}
                  onChange={(event) => setProfitRange((prev) => ({ ...prev, min: event.target.value }))}
                />
              </label>
              <label>
                Profit Max
                <input
                  type="number"
                  value={profitRange.max}
                  onChange={(event) => setProfitRange((prev) => ({ ...prev, max: event.target.value }))}
                />
              </label>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
