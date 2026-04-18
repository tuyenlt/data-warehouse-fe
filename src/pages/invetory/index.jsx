import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import MultiSelect from "../../components/MultiSelect";
import dimCuaHang from "../../data/dim_cua_hang.json";
import dimDiaDiem from "../../data/dim_dia_diem.json";
import dimMatHang from "../../data/dim_mat_hang.json";
import dimThoiGian from "../../data/dim_thoi_gian.json";
import factTonKho from "../../data/fact_ton_kho.json";
import "./inventory.css";

const MONTH_LABELS = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
const ITEMS_PER_PAGE = 10;
const LOCATION_LEVELS = ["region", "state", "city", "store"]; // Drill-down hierarchy

function formatCurrency(number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(number);
}

function formatNumber(number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(number);
}

export default function Inventory() {
  // OLAP State
  const [locationLevel, setLocationLevel] = useState("region"); // region | state | city | store (Drill-down)
  const [pivotBy, setPivotBy] = useState("store"); // store | city | state | region | product
  const [currentPage, setCurrentPage] = useState(1);

  // Slice filters (1 dimension - time)
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedQuarters, setSelectedQuarters] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);

  // Dice filters (multiple dimensions)
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Maps for quick lookup
  const storeByKey = useMemo(() => {
    const map = new Map();
    dimCuaHang.forEach((item) => map.set(item.CuaHangKey, item));
    return map;
  }, []);

  const locationByKey = useMemo(() => {
    const map = new Map();
    dimDiaDiem.forEach((item) => map.set(item.DiaDiemKey, item));
    return map;
  }, []);

  const productByKey = useMemo(() => {
    const map = new Map();
    dimMatHang.forEach((item) => map.set(item.MatHangKey, item));
    return map;
  }, []);

  const timeByKey = useMemo(() => {
    const map = new Map();
    dimThoiGian.forEach((item) => map.set(item.ThoiGianKey, item));
    return map;
  }, []);

  // Filter options
  const regionOptions = useMemo(() => {
    const regions = [...new Set(dimDiaDiem.map((item) => item.KhuVuc))].sort();
    return regions.map((r) => ({ value: r, label: r }));
  }, []);

  const stateOptions = useMemo(() => {
    const source = selectedRegions.length === 0
      ? dimDiaDiem
      : dimDiaDiem.filter((item) => selectedRegions.includes(item.KhuVuc));
    const states = [...new Set(source.map((item) => item.Bang))].sort();
    return states.map((s) => ({ value: s, label: s }));
  }, [selectedRegions]);

  const cityOptions = useMemo(() => {
    const source = selectedRegions.length === 0 && selectedStates.length === 0
      ? dimDiaDiem
      : dimDiaDiem.filter((item) =>
        (selectedRegions.length === 0 || selectedRegions.includes(item.KhuVuc)) &&
        (selectedStates.length === 0 || selectedStates.includes(item.Bang))
      );
    const cities = [...new Set(source.map((item) => item.ThanhPho))].sort();
    return cities.map((c) => ({ value: c, label: c }));
  }, [selectedRegions, selectedStates]);

  const categoryOptions = useMemo(() => {
    const categories = [...new Set(dimMatHang.map((item) => item.DanhMuc))].sort();
    return categories.map((cat) => ({ value: cat, label: cat }));
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
  }, [selectedYears, selectedQuarters]);

  // OLAP: Aggregate inventory data based on current state
  const olapData = useMemo(() => {
    const aggregated = new Map();

    factTonKho.forEach((row) => {
      const store = storeByKey.get(row.CuaHangKey);
      const product = productByKey.get(row.MatHangKey);
      const time = timeByKey.get(row.ThoiGianKey);
      if (!store || !product || !time) return;

      // Apply time level filters (Slice)
      if (selectedYears.length > 0 && !selectedYears.includes(String(time.Nam))) {
        return;
      }
      if (selectedQuarters.length > 0 && !selectedQuarters.includes(String(time.Quy))) {
        return;
      }
      if (selectedMonths.length > 0 && !selectedMonths.includes(String(time.Thang))) {
        return;
      }

      const location = locationByKey.get(store.DiaDiemKey);
      if (!location) return;

      // Apply Dice filters (multiple dimensions)
      if (selectedRegions.length > 0 && !selectedRegions.includes(location.KhuVuc)) {
        return;
      }
      if (selectedStates.length > 0 && !selectedStates.includes(location.Bang)) {
        return;
      }
      if (selectedCities.length > 0 && !selectedCities.includes(location.ThanhPho)) {
        return;
      }
      if (selectedCategories.length > 0 && !selectedCategories.includes(product.DanhMuc)) {
        return;
      }

      // Determine group key based on Pivot dimension
      let groupKey;
      let groupLabel;
      let groupDetails = {};

      if (pivotBy === "store") {
        groupKey = String(row.CuaHangKey);
        groupLabel = `${location.ThanhPho} - Store ${row.CuaHangKey}`;
        groupDetails = { store: row.CuaHangKey, location };
      } else if (pivotBy === "city") {
        groupKey = String(location.DiaDiemKey);
        groupLabel = location.ThanhPho;
        groupDetails = { location };
      } else if (pivotBy === "state") {
        groupKey = location.Bang;
        groupLabel = location.Bang;
        groupDetails = { state: location.Bang };
      } else if (pivotBy === "region") {
        groupKey = location.KhuVuc;
        groupLabel = location.KhuVuc;
        groupDetails = { region: location.KhuVuc };
      } else if (pivotBy === "product") {
        groupKey = String(row.MatHangKey);
        groupLabel = product.MoTa;
        groupDetails = { product };
      }

      if (!aggregated.has(groupKey)) {
        aggregated.set(groupKey, {
          key: groupKey,
          label: groupLabel,
          totalQuantity: 0,
          totalWeight: 0,
          totalValue: 0,
          ...groupDetails
        });
      }

      const record = aggregated.get(groupKey);
      record.totalQuantity += row.SoLuongTon;
      record.totalWeight += row.TrongLuong;
      record.totalValue += row.GiaTri;
    });

    return Array.from(aggregated.values())
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [
    storeByKey, locationByKey, productByKey, timeByKey,
    selectedYears, selectedQuarters, selectedMonths,
    selectedRegions, selectedStates, selectedCities, selectedCategories,
    pivotBy
  ]);

  // Chart data for visualization
  const chartOption = useMemo(() => {
    const labels = olapData.slice(0, 10).map(item => item.label);
    const values = olapData.slice(0, 10).map(item => item.totalValue);

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { top: 18, left: 92, right: 12, bottom: 32 },
      xAxis: { type: "value", axisLabel: { formatter: (value) => `${Math.round(value / 1000000)}M` } },
      yAxis: { type: "category", data: labels, axisLabel: { fontSize: 10 } },
      series: [
        {
          type: "bar",
          data: values,
          itemStyle: { color: "#1e8f78", borderRadius: [0, 6, 6, 0] }
        }
      ]
    };
  }, [olapData]);

  // Pagination
  const totalPages = Math.ceil(olapData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return olapData.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [olapData, currentPage]);

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const resetPagination = () => {
    setCurrentPage(1);
  };

  return (
    <section className="inventory-page">
      <header className="inventory-page__header">
        <h1>Phân tích Tồn kho (OLAP)</h1>
      </header>

      {/* OLAP Controls: Drill-down & Pivot */}
      <section className="inventory-olap-controls">
        <div className="olap-group">
          <h3>⬇️ Drill-down (Địa điểm)</h3>
          <div className="olap-buttons">
            <button
              className={`olap-btn ${locationLevel === "region" ? "olap-btn--active" : ""}`}
              onClick={() => {
                setLocationLevel("region");
                setSelectedStates([]);
                setSelectedCities([]);
                resetPagination();
              }}
            >
              Khu vực
            </button>
            <button
              className={`olap-btn ${locationLevel === "state" ? "olap-btn--active" : ""}`}
              onClick={() => {
                setLocationLevel("state");
                setSelectedCities([]);
                resetPagination();
              }}
            >
              Bang
            </button>
            <button
              className={`olap-btn ${locationLevel === "city" ? "olap-btn--active" : ""}`}
              onClick={() => {
                setLocationLevel("city");
                resetPagination();
              }}
            >
              Thành phố
            </button>
            <button
              className={`olap-btn ${locationLevel === "store" ? "olap-btn--active" : ""}`}
              onClick={() => {
                setLocationLevel("store");
                resetPagination();
              }}
            >
              Cửa hàng
            </button>
          </div>
        </div>

        <div className="olap-group">
          <h3>🔄 Pivot (Chiếu)</h3>
          <select
            className="olap-select"
            value={pivotBy}
            onChange={(e) => {
              setPivotBy(e.target.value);
              resetPagination();
            }}
          >
            <option value="store">Cửa hàng</option>
            <option value="city">Thành phố</option>
            <option value="state">Bang</option>
            <option value="region">Khu vực</option>
            <option value="product">Sản phẩm</option>
          </select>
        </div>
      </section>

      {/* Slice Filters (Time) */}
      <section className="inventory-filters">
        <h3>🔍 Slice (Lọc 1 chiều - Thời gian)</h3>
        <div className="inventory-filters__grid">
          <MultiSelect
            label="Năm"
            values={selectedYears}
            options={yearOptions}
            onChange={(values) => {
              setSelectedYears(values);
              setSelectedQuarters([]);
              setSelectedMonths([]);
              resetPagination();
            }}
            placeholder="Tất cả"
          />
          <MultiSelect
            label="Quý"
            values={selectedQuarters}
            options={quarterOptions}
            onChange={(values) => {
              setSelectedQuarters(values);
              setSelectedMonths([]);
              resetPagination();
            }}
            placeholder="Tất cả"
          />
          <MultiSelect
            label="Tháng"
            values={selectedMonths}
            options={monthOptions}
            onChange={(values) => {
              setSelectedMonths(values);
              resetPagination();
            }}
            placeholder="Tất cả"
          />
        </div>
      </section>

      {/* Dice Filters (Multiple Dimensions) */}
      <section className="inventory-filters">
        <h3>🎲 Dice (Lọc nhiều chiều)</h3>
        <div className="inventory-filters__grid">
          {locationLevel === "region" && (
            <MultiSelect
              label="Khu vực"
              values={selectedRegions}
              options={regionOptions}
              onChange={(values) => {
                setSelectedRegions(values);
                setSelectedStates([]);
                setSelectedCities([]);
                resetPagination();
              }}
              placeholder="Tất cả"
            />
          )}
          {(locationLevel === "state" || locationLevel === "city" || locationLevel === "store") && (
            <MultiSelect
              label="Khu vực"
              values={selectedRegions}
              options={regionOptions}
              onChange={(values) => {
                setSelectedRegions(values);
                setSelectedStates([]);
                setSelectedCities([]);
                resetPagination();
              }}
              placeholder="Tất cả"
            />
          )}
          {(locationLevel === "state" || locationLevel === "city" || locationLevel === "store") && (
            <MultiSelect
              label="Bang"
              values={selectedStates}
              options={stateOptions}
              onChange={(values) => {
                setSelectedStates(values);
                setSelectedCities([]);
                resetPagination();
              }}
              placeholder="Tất cả"
            />
          )}
          {(locationLevel === "city" || locationLevel === "store") && (
            <MultiSelect
              label="Thành phố"
              values={selectedCities}
              options={cityOptions}
              onChange={(values) => {
                setSelectedCities(values);
                resetPagination();
              }}
              placeholder="Tất cả"
            />
          )}
          <MultiSelect
            label="Danh mục sản phẩm"
            values={selectedCategories}
            options={categoryOptions}
            onChange={(values) => {
              setSelectedCategories(values);
              resetPagination();
            }}
            placeholder="Tất cả"
          />
        </div>
      </section>

      {/* Chart */}
      <section className="inventory-section">
        <h2>📊 Biểu đồ</h2>
        <div className="inventory-chart-wrapper">
          <ReactECharts option={chartOption} style={{ height: "350px" }} />
        </div>
      </section>

      {/* Table */}
      <section className="inventory-section">
        <h2>📋 Dữ liệu {pivotBy === "store" ? "Cửa hàng" : pivotBy === "city" ? "Thành phố" : pivotBy === "state" ? "Bang" : pivotBy === "region" ? "Khu vực" : "Sản phẩm"}</h2>
        <div className="inventory-table-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>{pivotBy === "store" ? "Cửa hàng" : pivotBy === "city" ? "Thành phố" : pivotBy === "state" ? "Bang" : pivotBy === "region" ? "Khu vực" : "Sản phẩm"}</th>
                <th>Số lượng tồn</th>
                <th>Trọng lượng (kg)</th>
                <th>Giá trị (VND)</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="text-bold">{row.label}</td>
                    <td className="text-right">{formatNumber(row.totalQuantity)}</td>
                    <td className="text-right">{formatNumber(Math.round(row.totalWeight))}</td>
                    <td className="text-right">{formatCurrency(row.totalValue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center empty-message">
                    Không có dữ liệu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="inventory-pagination">
            <button
              className="pagination-btn"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              ← Trước
            </button>
            <span className="pagination-info">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              className="pagination-btn"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              Tiếp →
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="inventory-summary">
          <div className="summary-card">
            <p>Tổng số lượng tồn</p>
            <h3>{formatNumber(olapData.reduce((sum, item) => sum + item.totalQuantity, 0))}</h3>
          </div>
          <div className="summary-card">
            <p>Tổng trọng lượng</p>
            <h3>{formatNumber(Math.round(olapData.reduce((sum, item) => sum + item.totalWeight, 0)))} kg</h3>
          </div>
          <div className="summary-card">
            <p>Tổng giá trị</p>
            <h3>{formatCurrency(olapData.reduce((sum, item) => sum + item.totalValue, 0))}</h3>
          </div>
        </div>
      </section>
    </section>
  );
}
