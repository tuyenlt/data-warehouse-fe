import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import MultiSelect from "../../components/MultiSelect";
import dimDiaDiem from "../../data/dim_dia_diem.json";
import dimThoiGian from "../../data/dim_thoi_gian.json";
import dimCuaHang from "../../data/dim_cua_hang.json";
import dimKhachHang from "../../data/dim_khach_hang.json";
import factBanHang from "../../data/fact_ban_hang.json";
import factTonKho from "../../data/fact_ton_kho.json";
import "./dashboard.css";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

function percentClass(percent) {
  if (percent == null) {
    return "kpi-card__change--neutral";
  }
  if (percent <= -5) {
    return "kpi-card__change--down";
  }
  if (percent > 0) {
    return "kpi-card__change--up";
  }
  return "kpi-card__change--neutral";
}

function percentText(percent) {
  if (percent == null) {
    return "No comparison";
  }
  if (percent > 0) {
    return `▲ +${percent.toFixed(1)}% increase`;
  }
  if (percent < 0) {
    return `▼ ${percent.toFixed(1)}% decrease`;
  }
  return "■ 0.0% unchanged";
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedQuarters, setSelectedQuarters] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);

  const timeByKey = useMemo(() => {
    const map = new Map();
    dimThoiGian.forEach((item) => map.set(item.ThoiGianKey, item));
    return map;
  }, []);

  const storeByKey = useMemo(() => {
    const map = new Map();
    dimCuaHang.forEach((item) => map.set(item.CuaHangKey, item));
    return map;
  }, []);

  const customerByKey = useMemo(() => {
    const map = new Map();
    dimKhachHang.forEach((item) => map.set(item.KhachHangKey, item));
    return map;
  }, []);

  const locationByKey = useMemo(() => {
    const map = new Map();
    dimDiaDiem.forEach((item) => map.set(item.DiaDiemKey, item));
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

  const stateOptions = useMemo(() => {
    const states = [...new Set(dimDiaDiem.map((item) => item.Bang))].sort();
    return states.map((state) => ({ value: state, label: state }));
  }, []);

  const cityOptions = useMemo(() => {
    const source = selectedStates.length === 0
      ? dimDiaDiem
      : dimDiaDiem.filter((item) => selectedStates.includes(item.Bang));
    const cities = [...new Set(source.map((item) => item.ThanhPho))].sort();
    return cities.map((city) => ({ value: city, label: city }));
  }, [selectedStates]);

  useEffect(() => {
    const monthSet = new Set(monthOptions.map((item) => item.value));
    setSelectedMonths((prev) => prev.filter((value) => monthSet.has(value)));
  }, [monthOptions]);

  useEffect(() => {
    const quarterSet = new Set(quarterOptions.map((item) => item.value));
    setSelectedQuarters((prev) => prev.filter((value) => quarterSet.has(value)));
  }, [quarterOptions]);

  useEffect(() => {
    const citySet = new Set(cityOptions.map((item) => item.value));
    setSelectedCities((prev) => prev.filter((value) => citySet.has(value)));
  }, [cityOptions]);

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

  function inLocationScope(locationKey) {
    const location = locationByKey.get(locationKey);
    if (!location) {
      return false;
    }

    if (selectedStates.length > 0 && !selectedStates.includes(location.Bang)) {
      return false;
    }
    if (selectedCities.length > 0 && !selectedCities.includes(location.ThanhPho)) {
      return false;
    }

    return true;
  }

  const filteredSales = useMemo(() => {
    return factBanHang.filter((row) => {
      if (!inTimeScope(row.ThoiGianKey)) {
        return false;
      }
      const customer = customerByKey.get(row.KhachHangKey);
      if (!customer) {
        return false;
      }
      return inLocationScope(customer.DiaDiem);
    });
  }, [customerByKey, selectedCities, selectedMonths, selectedQuarters, selectedStates, selectedYears, timeByKey]);

  const filteredInventory = useMemo(() => {
    return factTonKho.filter((row) => {
      if (!inTimeScope(row.ThoiGianKey)) {
        return false;
      }
      const store = storeByKey.get(row.CuaHangKey);
      if (!store) {
        return false;
      }
      return inLocationScope(store.DiaDiemKey);
    });
  }, [selectedCities, selectedMonths, selectedQuarters, selectedStates, selectedYears, storeByKey, timeByKey]);

  const groupedByTime = useMemo(() => {
    const revenueMap = new Map();
    const orderMap = new Map();
    const inventoryMap = new Map();

    filteredSales.forEach((row) => {
      const revenue = row.SoTienBanRa;
      revenueMap.set(row.ThoiGianKey, (revenueMap.get(row.ThoiGianKey) ?? 0) + revenue);
      orderMap.set(row.ThoiGianKey, (orderMap.get(row.ThoiGianKey) ?? 0) + row.SoLuong);
    });

    filteredInventory.forEach((row) => {
      inventoryMap.set(row.ThoiGianKey, (inventoryMap.get(row.ThoiGianKey) ?? 0) + row.SoLuongTon);
    });

    const timeKeys = [...new Set([...revenueMap.keys(), ...inventoryMap.keys()])].sort((a, b) => a - b);

    return { revenueMap, orderMap, inventoryMap, timeKeys };
  }, [filteredInventory, filteredSales]);

  function calculateChange(map) {
    const keys = [...map.keys()].sort((a, b) => a - b);
    if (keys.length < 2) {
      return null;
    }
    const current = map.get(keys[keys.length - 1]) ?? 0;
    const previous = map.get(keys[keys.length - 2]) ?? 0;
    if (previous === 0) {
      return null;
    }
    return ((current - previous) / previous) * 100;
  }

  const totals = useMemo(() => {
    let revenue = 0;
    let orders = 0;
    let inventory = 0;

    filteredSales.forEach((row) => {
      revenue += row.SoTienBanRa;
      orders += row.SoLuong;
    });

    filteredInventory.forEach((row) => {
      inventory += row.SoLuongTon;
    });

    return {
      revenue,
      orders,
      inventory,
      revenueChange: calculateChange(groupedByTime.revenueMap),
      ordersChange: calculateChange(groupedByTime.orderMap),
      inventoryChange: calculateChange(groupedByTime.inventoryMap)
    };
  }, [filteredInventory, filteredSales, groupedByTime]);

  const trendChart = useMemo(() => {
    const keys = groupedByTime.timeKeys.slice(-24);
    return {
      labels: keys.map((timeKey) => {
        const time = timeByKey.get(timeKey);
        return time ? `${MONTH_LABELS[time.Thang - 1]} ${time.Nam}` : String(timeKey);
      }),
      values: keys.map((timeKey) => groupedByTime.revenueMap.get(timeKey) ?? 0)
    };
  }, [groupedByTime, timeByKey]);

  const trendOption = useMemo(() => ({
    tooltip: { trigger: "axis" },
    grid: { top: 20, left: 40, right: 16, bottom: 28 },
    xAxis: { type: "category", data: trendChart.labels, axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", axisLabel: { formatter: (value) => `$${Math.round(value / 1000)}k` } },
    series: [
      {
        type: "line",
        smooth: true,
        data: trendChart.values,
        lineStyle: { color: "#2f7ccc" },
        areaStyle: { color: "rgba(47, 124, 204, 0.15)" },
        showSymbol: false
      }
    ]
  }), [trendChart]);

  const topProducts = useMemo(() => {
    const grouped = new Map();

    filteredSales.forEach((row) => {
      grouped.set(row.MatHangKey, (grouped.get(row.MatHangKey) ?? 0) + row.SoTienBanRa);
    });

    return [...grouped.entries()]
      .map(([key, value]) => ({
        key,
        name: `# ${key}`,
        value
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredSales]);

  const topProductOption = useMemo(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { top: 18, left: 92, right: 12, bottom: 32 },
    xAxis: { type: "value", axisLabel: { formatter: (value) => `$${Math.round(value / 1000)}k` } },
    yAxis: { type: "category", data: topProducts.map((item) => item.name), axisLabel: { fontSize: 10 } },
    series: [
      {
        type: "bar",
        data: topProducts.map((item) => item.value),
        itemStyle: { color: "#1e8f78", borderRadius: [0, 6, 6, 0] }
      }
    ]
  }), [topProducts]);

  const inventoryByStore = useMemo(() => {
    const grouped = new Map();

    filteredInventory.forEach((row) => {
      const store = storeByKey.get(row.CuaHangKey);
      if (!store) {
        return;
      }
      const location = locationByKey.get(store.DiaDiemKey);
      const storeLabel = location ? `Store ${row.CuaHangKey} (${location.Bang})` : `Store ${row.CuaHangKey}`;
      grouped.set(storeLabel, (grouped.get(storeLabel) ?? 0) + row.SoLuongTon);
    });

    return [...grouped.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredInventory, locationByKey, storeByKey]);

  const inventoryOption = useMemo(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { top: 18, left: 100, right: 12, bottom: 32 },
    xAxis: { type: "value", axisLabel: { formatter: (value) => formatNumber(value) } },
    yAxis: { type: "category", data: inventoryByStore.map((item) => item.name), axisLabel: { fontSize: 10 } },
    series: [
      {
        type: "bar",
        data: inventoryByStore.map((item) => item.value),
        itemStyle: { color: "#2f7ccc", borderRadius: [0, 6, 6, 0] }
      }
    ]
  }), [inventoryByStore]);

  return (
    <section className="dashboard-v2-page">
      <header className="dashboard-v2-page__header">
        <h1>Executive Dashboard</h1>
      </header>

      <section className="dashboard-v2-filters">
        <h3>Filters</h3>
        <div className="dashboard-v2-filters__grid">
          <MultiSelect label="Year" values={selectedYears} options={yearOptions} onChange={setSelectedYears} />
          <MultiSelect label="Quarter" values={selectedQuarters} options={quarterOptions} onChange={setSelectedQuarters} />
          <MultiSelect label="Month" values={selectedMonths} options={monthOptions} onChange={setSelectedMonths} />
          <MultiSelect label="State" values={selectedStates} options={stateOptions} onChange={(values) => {
            setSelectedStates(values);
            setSelectedCities([]);
          }} />
          <MultiSelect label="City" values={selectedCities} options={cityOptions} onChange={setSelectedCities} />
        </div>
      </section>

      <section className="dashboard-v2-kpis">
        <article className="kpi-card">
          <p>Revenue</p>
          <h2>{formatCurrency(totals.revenue)}</h2>
          <span className={`kpi-card__change ${percentClass(totals.revenueChange)}`}>{percentText(totals.revenueChange)}</span>
        </article>

        <article className="kpi-card">
          <p>Orders</p>
          <h2>{formatNumber(totals.orders)}</h2>
          <span className={`kpi-card__change ${percentClass(totals.ordersChange)}`}>{percentText(totals.ordersChange)}</span>
        </article>

        <article className="kpi-card">
          <p>Inventory</p>
          <h2>{formatNumber(totals.inventory)}</h2>
          <span className={`kpi-card__change ${percentClass(totals.inventoryChange)}`}>{percentText(totals.inventoryChange)}</span>
        </article>
      </section>

      <section className="dashboard-v2-mini-charts">
        <article className="mini-chart-card" onClick={() => navigate("/sale")}> 
          <h4>Revenue Trend</h4>
          <ReactECharts option={trendOption} style={{ height: "220px" }} />
        </article>

        <article className="mini-chart-card" onClick={() => navigate("/sale")}> 
          <h4>Top Products</h4>
          <ReactECharts option={topProductOption} style={{ height: "220px" }} />
        </article>

        <article className="mini-chart-card" onClick={() => navigate("/inventory")}> 
          <h4>Inventory by Store</h4>
          <ReactECharts option={inventoryOption} style={{ height: "220px" }} />
        </article>
      </section>
    </section>
  );
}
