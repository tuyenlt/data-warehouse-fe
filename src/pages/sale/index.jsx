import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import MultiSelect from "../../components/MultiSelect";
import dimThoiGian from "../../data/dim_thoi_gian.json";
import dimKhachHang from "../../data/dim_khach_hang.json";
import dimMatHang from "../../data/dim_mat_hang.json";
import factBanHang from "../../data/fact_ban_hang.json";
import "./sale.css";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PAGE_SIZE = 12;

const FACT_MEASURE_LABELS = {
  SoLuong: "Quantity",
  SoTienBanRa: "Sales Amount",
  SoTienLai: "Profit Amount",
  SoLaiTrungBinh: "Average Profit Amount"
};

function formatCurrency(number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(number);
}

function formatNumber(number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(number);
}

function aggregateByTimeLevel(filteredSales, timeByKey, metricFn, timeLevel) {
  const map = new Map();

  filteredSales.forEach((row) => {
    const time = timeByKey.get(row.ThoiGianKey);
    if (!time) {
      return;
    }

    const key = timeLevel === 2
      ? `${time.Nam}`
      : timeLevel === 1
        ? `${time.Nam}|${time.Quy}`
        : `${time.Nam}|${time.Quy}|${time.Thang}`;

    const prev = map.get(key) ?? {
      year: time.Nam,
      quarter: time.Quy,
      month: time.Thang,
      value: 0
    };

    prev.value += metricFn(row);
    map.set(key, prev);
  });

  return [...map.values()].sort((a, b) => {
    if (a.year !== b.year) {
      return a.year - b.year;
    }
    if (a.quarter !== b.quarter) {
      return a.quarter - b.quarter;
    }
    return a.month - b.month;
  });
}

export default function SalePage() {
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedQuarters, setSelectedQuarters] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [timeLevel, setTimeLevel] = useState(0);
  const [page, setPage] = useState(1);

  const [chartMenu, setChartMenu] = useState(null);
  const [showSliceDice, setShowSliceDice] = useState(false);

  const [pivotRevenueTime, setPivotRevenueTime] = useState(false);
  const [pivotQtyTime, setPivotQtyTime] = useState(false);
  const [pivotProductRevenue, setPivotProductRevenue] = useState(false);

  const projectionOptions = useMemo(() => {
    const keys = Object.keys(factBanHang[0] ?? {});
    const allowed = ["SoLuong", "SoTienBanRa", "SoTienLai", "SoLaiTrungBinh"];
    return keys
      .filter((key) => allowed.includes(key))
      .map((key) => ({ value: key, label: FACT_MEASURE_LABELS[key] ?? key }));
  }, []);

  const [visibleMeasureColumns, setVisibleMeasureColumns] = useState(() => projectionOptions.map((item) => item.value));

  const timeByKey = useMemo(() => {
    const map = new Map();
    dimThoiGian.forEach((item) => map.set(item.ThoiGianKey, item));
    return map;
  }, []);

  const customerByKey = useMemo(() => {
    const map = new Map();
    dimKhachHang.forEach((item) => map.set(item.KhachHangKey, item));
    return map;
  }, []);

  const productByKey = useMemo(() => {
    const map = new Map();
    dimMatHang.forEach((item) => map.set(item.MatHangKey, item));
    return map;
  }, []);

  const yearOptions = useMemo(() => {
    const years = [...new Set(dimThoiGian.map((item) => item.Nam))].sort((a, b) => b - a);
    return years.map((year) => ({ value: String(year), label: String(year) }));
  }, []);

  const quarterOptions = useMemo(() => {
    const quarters = [...new Set(dimThoiGian
      .filter((item) => selectedYears.length === 0 || selectedYears.includes(String(item.Nam)))
      .map((item) => item.Quy))].sort((a, b) => a - b);
    return quarters.map((q) => ({ value: String(q), label: `Q${q}` }));
  }, [selectedYears]);

  const monthOptions = useMemo(() => {
    const months = [...new Set(dimThoiGian
      .filter((item) => (selectedYears.length === 0 || selectedYears.includes(String(item.Nam)))
        && (selectedQuarters.length === 0 || selectedQuarters.includes(String(item.Quy))))
      .map((item) => item.Thang))].sort((a, b) => a - b);

    return months.map((month) => ({ value: String(month), label: MONTH_LABELS[month - 1] }));
  }, [selectedQuarters, selectedYears]);

  const productOptions = useMemo(() => {
    return dimMatHang
      .map((item) => item.MatHangKey)
      .sort((a, b) => a - b)
      .map((id) => ({ value: String(id), label: `# ${id}` }));
  }, []);

  useEffect(() => {
    const monthSet = new Set(monthOptions.map((item) => item.value));
    setSelectedMonths((prev) => prev.filter((value) => monthSet.has(value)));
  }, [monthOptions]);

  useEffect(() => {
    const quarterSet = new Set(quarterOptions.map((item) => item.value));
    setSelectedQuarters((prev) => prev.filter((value) => quarterSet.has(value)));
  }, [quarterOptions]);

  useEffect(() => {
    const valid = new Set(projectionOptions.map((item) => item.value));
    setVisibleMeasureColumns((prev) => prev.filter((item) => valid.has(item)));
  }, [projectionOptions]);

  function inTimeScope(timeKey) {
    const time = timeByKey.get(timeKey);
    if (!time) {
      return false;
    }

    if (selectedYears.length > 0 && !selectedYears.includes(String(time.Nam))) {
      return false;
    }
    if (selectedQuarters.length > 0 && !selectedQuarters.includes(String(time.Quy))) {
      return false;
    }
    if (selectedMonths.length > 0 && !selectedMonths.includes(String(time.Thang))) {
      return false;
    }

    return true;
  }

  const filteredSales = useMemo(() => {
    return factBanHang.filter((row) => {
      if (!inTimeScope(row.ThoiGianKey)) {
        return false;
      }
      if (!productByKey.get(row.MatHangKey)) {
        return false;
      }
      if (!customerByKey.get(row.KhachHangKey)) {
        return false;
      }
      if (selectedProducts.length > 0 && !selectedProducts.includes(String(row.MatHangKey))) {
        return false;
      }
      return true;
    });
  }, [customerByKey, productByKey, selectedMonths, selectedProducts, selectedQuarters, selectedYears, timeByKey]);

  const kpis = useMemo(() => {
    let revenue = 0;
    let quantity = 0;
    let profit = 0;
    let avgProfitSum = 0;

    filteredSales.forEach((row) => {
      revenue += row.SoTienBanRa;
      quantity += row.SoLuong;
      profit += row.SoTienLai;
      avgProfitSum += row.SoLaiTrungBinh;
    });

    return {
      revenue,
      quantity,
      profit,
      avgProfit: filteredSales.length === 0 ? 0 : avgProfitSum / filteredSales.length
    };
  }, [filteredSales]);

  function openChartMenu(event, chartType) {
    event.preventDefault();
    setChartMenu({ x: event.clientX, y: event.clientY, chartType });
  }

  function menuItems() {
    if (!chartMenu) {
      return [];
    }

    const items = [];
    const isTimeScope = chartMenu.chartType === "revenue-time" || chartMenu.chartType === "quantity-time" || chartMenu.chartType === "sale-detail";

    if (isTimeScope && timeLevel < 2) {
      items.push({
        label: "Roll up",
        action: () => {
          setTimeLevel((prev) => {
            const next = Math.min(2, prev + 1);
            if (next >= 1) {
              setSelectedMonths([]);
            }
            if (next >= 2) {
              setSelectedQuarters([]);
            }
            return next;
          });
          setPage(1);
        }
      });
    }

    if (isTimeScope && timeLevel > 0) {
      items.push({
        label: "Drill down",
        action: () => {
          setTimeLevel((prev) => Math.max(0, prev - 1));
          setPage(1);
        }
      });
    }

    if (chartMenu.chartType === "revenue-time") {
      items.push({ label: pivotRevenueTime ? "Unpivot" : "Pivot", action: () => setPivotRevenueTime((prev) => !prev) });
    }

    if (chartMenu.chartType === "quantity-time") {
      items.push({ label: pivotQtyTime ? "Unpivot" : "Pivot", action: () => setPivotQtyTime((prev) => !prev) });
    }

    if (chartMenu.chartType === "product-revenue") {
      items.push({ label: pivotProductRevenue ? "Unpivot" : "Pivot", action: () => setPivotProductRevenue((prev) => !prev) });
    }

    items.push({
      label: "Slice & Dice",
      action: () => setShowSliceDice(true)
    });

    return items;
  }

  const timeSeriesBase = useMemo(() => {
    const years = selectedYears.length > 0
      ? selectedYears.map(Number).sort((a, b) => a - b).slice(-10)
      : [...new Set(filteredSales
        .map((row) => timeByKey.get(row.ThoiGianKey)?.Nam)
        .filter(Boolean))].sort((a, b) => a - b).slice(-10);

    const buckets = timeLevel === 0
      ? MONTH_LABELS
      : timeLevel === 1
        ? ["Q1", "Q2", "Q3", "Q4"]
        : years.map(String);

    function byMetric(metricFn) {
      if (timeLevel === 2) {
        const yearly = new Map();
        filteredSales.forEach((row) => {
          const time = timeByKey.get(row.ThoiGianKey);
          if (!time) {
            return;
          }
          yearly.set(time.Nam, (yearly.get(time.Nam) ?? 0) + metricFn(row));
        });

        const labels = [...yearly.keys()].sort((a, b) => a - b);
        return {
          mode: "year",
          xLabels: labels.map(String),
          singleSeriesData: labels.map((year) => yearly.get(year) ?? 0),
          matrixYears: [],
          matrixBuckets: []
        };
      }

      const grouped = new Map();
      filteredSales.forEach((row) => {
        const time = timeByKey.get(row.ThoiGianKey);
        if (!time || !years.includes(time.Nam)) {
          return;
        }
        const bucket = timeLevel === 1 ? time.Quy : time.Thang;
        grouped.set(`${time.Nam}-${bucket}`, (grouped.get(`${time.Nam}-${bucket}`) ?? 0) + metricFn(row));
      });

      return {
        mode: "matrix",
        matrixYears: years,
        matrixBuckets: buckets,
        matrixValuesByYear: years.map((year) => ({
          year,
          values: buckets.map((_, idx) => grouped.get(`${year}-${idx + 1}`) ?? 0)
        }))
      };
    }

    return {
      revenue: byMetric((row) => row.SoTienBanRa),
      quantity: byMetric((row) => row.SoLuong)
    };
  }, [filteredSales, selectedYears, timeByKey, timeLevel]);

  function legendFormatterWithRows(seriesNames) {
    const nameToIndex = new Map(seriesNames.map((name, idx) => [name, idx]));
    return (name) => {
      const idx = nameToIndex.get(name) ?? -1;
      if (idx >= 0 && (idx + 1) % 5 === 0) {
        return `${name}\n`;
      }
      return name;
    };
  }

  function buildTimeOption(color, dataSet, pivoted, axisLabelFormatter) {
    if (dataSet.mode === "year") {
      return {
        tooltip: { trigger: "axis" },
        grid: { top: 30, left: 48, right: 18, bottom: 32 },
        xAxis: {
          type: pivoted ? "value" : "category",
          data: pivoted ? undefined : dataSet.xLabels,
          axisLabel: pivoted ? { formatter: axisLabelFormatter } : undefined
        },
        yAxis: {
          type: pivoted ? "category" : "value",
          data: pivoted ? dataSet.xLabels : undefined,
          axisLabel: pivoted ? undefined : { formatter: axisLabelFormatter }
        },
        series: [{ type: "bar", data: dataSet.singleSeriesData, itemStyle: { color, borderRadius: pivoted ? [0, 6, 6, 0] : [6, 6, 0, 0] } }]
      };
    }

    const years = dataSet.matrixValuesByYear.map((series) => String(series.year));

    if (!pivoted) {
      return {
        tooltip: { trigger: "axis" },
        legend: { top: 0, formatter: legendFormatterWithRows(years) },
        grid: { top: 54, left: 48, right: 18, bottom: 32 },
        xAxis: { type: "category", data: dataSet.matrixBuckets },
        yAxis: { type: "value", axisLabel: { formatter: axisLabelFormatter } },
        series: dataSet.matrixValuesByYear.map((series) => ({
          name: String(series.year),
          type: "line",
          smooth: true,
          data: series.values
        }))
      };
    }

    const bucketSeries = dataSet.matrixBuckets.map((bucket, bucketIdx) => ({
      name: bucket,
      values: dataSet.matrixYears.map((_, yearIdx) => dataSet.matrixValuesByYear[yearIdx]?.values[bucketIdx] ?? 0)
    }));

    return {
      tooltip: { trigger: "item" },
      legend: { top: 0, formatter: legendFormatterWithRows(bucketSeries.map((item) => item.name)) },
      grid: { top: 54, left: 68, right: 18, bottom: 20 },
      xAxis: { type: "value", axisLabel: { formatter: axisLabelFormatter } },
      yAxis: { type: "category", data: dataSet.matrixYears.map(String) },
      series: bucketSeries.map((series) => ({
        name: series.name,
        type: "line",
        smooth: true,
        symbolSize: 7,
        data: dataSet.matrixYears.map((year, idx) => [series.values[idx] ?? 0, String(year)])
      }))
    };
  }

  const revenueByTimeOption = useMemo(
    () => buildTimeOption("#2f7ccc", timeSeriesBase.revenue, pivotRevenueTime, (value) => `$${Math.round(value / 1000)}k`),
    [pivotRevenueTime, timeSeriesBase]
  );

  const quantityByTimeOption = useMemo(
    () => buildTimeOption("#1f8f84", timeSeriesBase.quantity, pivotQtyTime, (value) => formatNumber(value)),
    [pivotQtyTime, timeSeriesBase]
  );

  const revenueByProductData = useMemo(() => {
    const grouped = new Map();

    filteredSales.forEach((row) => {
      grouped.set(row.MatHangKey, (grouped.get(row.MatHangKey) ?? 0) + row.SoTienBanRa);
    });

    const sorted = [...grouped.entries()]
      .map(([id, value]) => ({ id, label: `# ${id}`, value }))
      .sort((a, b) => b.value - a.value);

    const top10 = sorted.slice(0, 10);
    const othersValue = sorted.slice(10).reduce((sum, item) => sum + item.value, 0);
    if (othersValue > 0) {
      top10.push({ id: -1, label: "Others", value: othersValue });
    }

    return top10;
  }, [filteredSales]);

  const revenueByProductOption = useMemo(() => {
    const labels = revenueByProductData.map((item) => item.label);
    const values = revenueByProductData.map((item) => item.value);

    if (!pivotProductRevenue) {
      return {
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        grid: { top: 20, left: 96, right: 16, bottom: 38 },
        xAxis: { type: "value", axisLabel: { formatter: (value) => `$${Math.round(value / 1000)}k` } },
        yAxis: { type: "category", data: labels },
        series: [{ type: "bar", data: values, itemStyle: { color: "#7b57d6", borderRadius: [0, 6, 6, 0] } }]
      };
    }

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { top: 20, left: 48, right: 16, bottom: 76 },
      xAxis: { type: "category", data: labels, axisLabel: { rotate: 24 } },
      yAxis: { type: "value", axisLabel: { formatter: (value) => `$${Math.round(value / 1000)}k` } },
      series: [{ type: "bar", data: values, itemStyle: { color: "#7b57d6", borderRadius: [6, 6, 0, 0] } }]
    };
  }, [pivotProductRevenue, revenueByProductData]);

  const revenueTimeRows = useMemo(
    () => aggregateByTimeLevel(filteredSales, timeByKey, (row) => row.SoTienBanRa, timeLevel),
    [filteredSales, timeByKey, timeLevel]
  );

  const quantityTimeRows = useMemo(
    () => aggregateByTimeLevel(filteredSales, timeByKey, (row) => row.SoLuong, timeLevel),
    [filteredSales, timeByKey, timeLevel]
  );

  const revenuePivotRows = useMemo(() => {
    if (!pivotRevenueTime || timeSeriesBase.revenue.mode === "year") {
      return [];
    }

    return timeSeriesBase.revenue.matrixYears.map((year, idx) => ({
      year,
      values: timeSeriesBase.revenue.matrixBuckets.map((_, bucketIdx) => timeSeriesBase.revenue.matrixValuesByYear[idx]?.values[bucketIdx] ?? 0)
    }));
  }, [pivotRevenueTime, timeSeriesBase.revenue]);

  const quantityPivotRows = useMemo(() => {
    if (!pivotQtyTime || timeSeriesBase.quantity.mode === "year") {
      return [];
    }

    return timeSeriesBase.quantity.matrixYears.map((year, idx) => ({
      year,
      values: timeSeriesBase.quantity.matrixBuckets.map((_, bucketIdx) => timeSeriesBase.quantity.matrixValuesByYear[idx]?.values[bucketIdx] ?? 0)
    }));
  }, [pivotQtyTime, timeSeriesBase.quantity]);

  const timeRevenueEvents = useMemo(() => ({
    click: (params) => {
      const targetYear = timeSeriesBase.revenue.mode === "year" ? Number(params?.name) : Number(params?.seriesName);
      if (Number.isFinite(targetYear)) {
        setSelectedYears([String(targetYear)]);
      }
    }
  }), [timeSeriesBase.revenue.mode]);

  const timeQuantityEvents = useMemo(() => ({
    click: (params) => {
      const targetYear = timeSeriesBase.quantity.mode === "year" ? Number(params?.name) : Number(params?.seriesName);
      if (Number.isFinite(targetYear)) {
        setSelectedYears([String(targetYear)]);
      }
    }
  }), [timeSeriesBase.quantity.mode]);

  const detailRows = useMemo(() => {
    const grouped = new Map();

    filteredSales.forEach((row) => {
      const time = timeByKey.get(row.ThoiGianKey);
      const customer = customerByKey.get(row.KhachHangKey);
      if (!time || !customer) {
        return;
      }

      const timeBucketKey = timeLevel === 2
        ? `${time.Nam}`
        : timeLevel === 1
          ? `${time.Nam}|${time.Quy}`
          : `${time.Nam}|${time.Quy}|${time.Thang}`;

      const key = `${timeBucketKey}|${row.MatHangKey}|${customer.TenKH}`;

      const prev = grouped.get(key) ?? {
        productId: row.MatHangKey,
        year: time.Nam,
        quarter: time.Quy,
        month: time.Thang,
        customerName: customer.TenKH,
        SoLuong: 0,
        SoTienBanRa: 0,
        SoTienLai: 0,
        soLaiAcc: 0,
        count: 0
      };

      prev.SoLuong += row.SoLuong;
      prev.SoTienBanRa += row.SoTienBanRa;
      prev.SoTienLai += row.SoTienLai;
      prev.soLaiAcc += row.SoLaiTrungBinh;
      prev.count += 1;

      grouped.set(key, prev);
    });

    return [...grouped.values()]
      .map((row) => ({
        ...row,
        SoLaiTrungBinh: row.count === 0 ? 0 : row.soLaiAcc / row.count
      }))
      .sort((a, b) => {
        if (b.year !== a.year) {
          return b.year - a.year;
        }
        if ((b.quarter ?? 0) !== (a.quarter ?? 0)) {
          return (b.quarter ?? 0) - (a.quarter ?? 0);
        }
        if ((b.month ?? 0) !== (a.month ?? 0)) {
          return (b.month ?? 0) - (a.month ?? 0);
        }
        if (a.productId !== b.productId) {
          return a.productId - b.productId;
        }
        return a.customerName.localeCompare(b.customerName);
      });
  }, [customerByKey, filteredSales, timeByKey, timeLevel]);

  const totalPages = Math.max(1, Math.ceil(detailRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = detailRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function isVisible(measureKey) {
    return visibleMeasureColumns.includes(measureKey);
  }

  return (
    <section className="sale-v2-page" onClick={() => setChartMenu(null)}>
      <header className="sale-v2-page__header">
        <h1>Sales Analytics</h1>
      </header>

      <div className={`sale-v2-layout ${showSliceDice ? "sale-v2-layout--panel-open" : ""}`}>
        <div className="sale-v2-main">
          <div className="sale-v2-cards">
            <article className="sale-kpi-card">
              <p>Total Revenue</p>
              <h2>{formatCurrency(kpis.revenue)}</h2>
            </article>
            <article className="sale-kpi-card">
              <p>Total Quantity</p>
              <h2>{formatNumber(kpis.quantity)}</h2>
            </article>
            <article className="sale-kpi-card">
              <p>Total Profit</p>
              <h2>{formatCurrency(kpis.profit)}</h2>
            </article>
            <article className="sale-kpi-card">
              <p>Average Profit Amount</p>
              <h2>{formatCurrency(kpis.avgProfit)}</h2>
            </article>
          </div>

          <div className="sale-v2-charts">
            <article className="sale-chart-card" onContextMenu={(event) => openChartMenu(event, "revenue-time")}>
              <h3>Revenue by Time</h3>
              <ReactECharts
                key={`revenue-time-${timeLevel}-${pivotRevenueTime}-${selectedYears.join("|")}-${selectedQuarters.join("|")}-${selectedMonths.join("|")}`}
                option={revenueByTimeOption}
                onEvents={timeRevenueEvents}
                notMerge
                style={{ height: showSliceDice ? "280px" : "300px" }}
              />

              <div className="chart-data-table">
                <table>
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Year</th>
                      {!pivotRevenueTime && timeLevel <= 1 ? <th>Quarter</th> : null}
                      {!pivotRevenueTime && timeLevel === 0 ? <th>Month</th> : null}
                      {!pivotRevenueTime ? <th>Revenue</th> : null}
                      {pivotRevenueTime && timeSeriesBase.revenue.mode !== "year"
                        ? timeSeriesBase.revenue.matrixBuckets.map((bucket) => <th key={`revenue-bucket-${bucket}`}>{bucket}</th>)
                        : null}
                    </tr>
                  </thead>
                  <tbody>
                    {(pivotRevenueTime && timeSeriesBase.revenue.mode !== "year" ? revenuePivotRows : revenueTimeRows).map((row, idx) => (
                      <tr key={`revenue-row-${row.year}-${row.quarter ?? "x"}-${row.month ?? "x"}`}>
                        <td>{idx + 1}</td>
                        <td>{row.year}</td>
                        {!pivotRevenueTime && timeLevel <= 1 ? <td>Q{row.quarter}</td> : null}
                        {!pivotRevenueTime && timeLevel === 0 ? <td>{MONTH_LABELS[row.month - 1]}</td> : null}
                        {!pivotRevenueTime ? <td>{formatCurrency(row.value)}</td> : null}
                        {pivotRevenueTime && timeSeriesBase.revenue.mode !== "year"
                          ? row.values.map((value, valueIdx) => <td key={`revenue-v-${idx}-${valueIdx}`}>{formatCurrency(value)}</td>)
                          : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="sale-chart-card" onContextMenu={(event) => openChartMenu(event, "quantity-time")}>
              <h3>Quantity Sold by Time</h3>
              <ReactECharts
                key={`quantity-time-${timeLevel}-${pivotQtyTime}-${selectedYears.join("|")}-${selectedQuarters.join("|")}-${selectedMonths.join("|")}`}
                option={quantityByTimeOption}
                onEvents={timeQuantityEvents}
                notMerge
                style={{ height: showSliceDice ? "280px" : "300px" }}
              />

              <div className="chart-data-table">
                <table>
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Year</th>
                      {!pivotQtyTime && timeLevel <= 1 ? <th>Quarter</th> : null}
                      {!pivotQtyTime && timeLevel === 0 ? <th>Month</th> : null}
                      {!pivotQtyTime ? <th>Quantity</th> : null}
                      {pivotQtyTime && timeSeriesBase.quantity.mode !== "year"
                        ? timeSeriesBase.quantity.matrixBuckets.map((bucket) => <th key={`quantity-bucket-${bucket}`}>{bucket}</th>)
                        : null}
                    </tr>
                  </thead>
                  <tbody>
                    {(pivotQtyTime && timeSeriesBase.quantity.mode !== "year" ? quantityPivotRows : quantityTimeRows).map((row, idx) => (
                      <tr key={`quantity-row-${row.year}-${row.quarter ?? "x"}-${row.month ?? "x"}`}>
                        <td>{idx + 1}</td>
                        <td>{row.year}</td>
                        {!pivotQtyTime && timeLevel <= 1 ? <td>Q{row.quarter}</td> : null}
                        {!pivotQtyTime && timeLevel === 0 ? <td>{MONTH_LABELS[row.month - 1]}</td> : null}
                        {!pivotQtyTime ? <td>{formatNumber(row.value)}</td> : null}
                        {pivotQtyTime && timeSeriesBase.quantity.mode !== "year"
                          ? row.values.map((value, valueIdx) => <td key={`quantity-v-${idx}-${valueIdx}`}>{formatNumber(value)}</td>)
                          : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="sale-chart-card" onContextMenu={(event) => openChartMenu(event, "product-revenue")}>
              <h3>Revenue by Product</h3>
              <ReactECharts
                key={`product-revenue-${pivotProductRevenue}-${selectedYears.join("|")}-${selectedQuarters.join("|")}-${selectedMonths.join("|")}`}
                option={revenueByProductOption}
                notMerge
                style={{ height: showSliceDice ? "280px" : "300px" }}
              />

              <div className="chart-data-table chart-data-table--tight">
                <table>
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Product Id</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueByProductData.map((row, idx) => (
                      <tr
                        key={`product-row-${row.id}-${idx}`}
                        onClick={() => {
                          if (row.id > 0) {
                            setSelectedProducts([String(row.id)]);
                          }
                        }}
                      >
                        <td>{idx + 1}</td>
                        <td>{row.id > 0 ? `# ${row.id}` : "Others"}</td>
                        <td>{formatCurrency(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>

          <article className="sale-v2-table-card" onContextMenu={(event) => openChartMenu(event, "sale-detail")}>
            <h3>Sales Detail Data</h3>
            <div className="sale-v2-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Product Id</th>
                    <th>Year</th>
                    {timeLevel <= 1 ? <th>Quarter</th> : null}
                    {timeLevel === 0 ? <th>Month</th> : null}
                    <th>Customer</th>
                    {isVisible("SoLuong") ? <th>Quantity</th> : null}
                    {isVisible("SoTienBanRa") ? <th>Sales Amount</th> : null}
                    {isVisible("SoTienLai") ? <th>Profit Amount</th> : null}
                    {isVisible("SoLaiTrungBinh") ? <th>Average Profit Amount</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, idx) => (
                    <tr key={`${safePage}-${idx}-${row.productId}-${row.customerName}-${row.year}-${row.month}`}>
                      <td>{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                      <td>{`# ${row.productId}`}</td>
                      <td>{row.year}</td>
                      {timeLevel <= 1 ? <td>Q{row.quarter}</td> : null}
                      {timeLevel === 0 ? <td>{MONTH_LABELS[(row.month ?? 1) - 1]}</td> : null}
                      <td>{row.customerName}</td>
                      {isVisible("SoLuong") ? <td>{formatNumber(row.SoLuong)}</td> : null}
                      {isVisible("SoTienBanRa") ? <td>{formatCurrency(row.SoTienBanRa)}</td> : null}
                      {isVisible("SoTienLai") ? <td>{formatCurrency(row.SoTienLai)}</td> : null}
                      {isVisible("SoLaiTrungBinh") ? <td>{formatCurrency(row.SoLaiTrungBinh)}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-pagination">
              <button type="button" disabled={safePage <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Prev
              </button>
              <span>Page {safePage} / {totalPages}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
                Next
              </button>
            </div>
          </article>
        </div>

        {showSliceDice ? (
          <aside className="slice-dice-panel">
            <div className="slice-dice-panel__head">
              <h4>Slice &amp; Dice</h4>
              <button type="button" onClick={() => setShowSliceDice(false)}>x</button>
            </div>

            <div className="slice-dice-panel__group">
              <p>Time</p>
              <MultiSelect label="Year" values={selectedYears} options={yearOptions} onChange={setSelectedYears} />
              {timeLevel <= 1 ? (
                <MultiSelect label="Quarter" values={selectedQuarters} options={quarterOptions} onChange={setSelectedQuarters} />
              ) : null}
              {timeLevel === 0 ? (
                <MultiSelect label="Month" values={selectedMonths} options={monthOptions} onChange={setSelectedMonths} />
              ) : null}
            </div>

            <div className="slice-dice-panel__group">
              <p>Entity</p>
              <MultiSelect label="Product Id" values={selectedProducts} options={productOptions} onChange={setSelectedProducts} />
            </div>

            <div className="slice-dice-panel__group">
              <p>Projection: </p>
              <div className="projection-list">
                {projectionOptions.map((column) => (
                  <label key={column.value} className="projection-item">
                    <input
                      type="checkbox"
                      checked={visibleMeasureColumns.includes(column.value)}
                      onChange={() => {
                        setVisibleMeasureColumns((prev) => {
                          if (prev.includes(column.value)) {
                            return prev.filter((item) => item !== column.value);
                          }
                          return [...prev, column.value];
                        });
                      }}
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {chartMenu ? (
        <ul className="chart-menu" style={{ top: `${chartMenu.y}px`, left: `${chartMenu.x}px` }}>
          {menuItems().map((item) => (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => {
                  item.action();
                  setChartMenu(null);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
