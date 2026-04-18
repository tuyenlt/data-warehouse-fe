import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import MultiSelect from "../../components/MultiSelect";
import dimDiaDiem from "../../data/dim_dia_diem.json";
import dimThoiGian from "../../data/dim_thoi_gian.json";
import dimKhachHang from "../../data/dim_khach_hang.json";
import factBanHang from "../../data/fact_ban_hang.json";
import "./customer.css";

const MONTH_LABELS = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
const ITEMS_PER_PAGE = 10;

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

export default function Customer() {
  // OLAP State
  const [timeLevel, setTimeLevel] = useState("year"); // year | quarter | month
  const [currentPage, setCurrentPage] = useState(1);

  // Selected customer for detail view
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Dice filters (multiple dimensions)
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedQuarters, setSelectedQuarters] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);

  // Maps for quick lookup
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

  const locationByKey = useMemo(() => {
    const map = new Map();
    dimDiaDiem.forEach((item) => map.set(item.DiaDiemKey, item));
    return map;
  }, []);

  const cityOptions = useMemo(() => {
    const source = selectedStates.length === 0
      ? dimDiaDiem
      : dimDiaDiem.filter((item) => selectedStates.includes(item.Bang));
    const cities = [...new Set(source.map((item) => item.ThanhPho))].sort();
    return cities.map((city) => ({ value: city, label: city }));
  }, [selectedStates]);

  const stateOptions = useMemo(() => {
    const states = [...new Set(dimDiaDiem.map((item) => item.Bang))].sort();
    return states.map((state) => ({ value: state, label: state }));
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

  // REQUEST 9: Get customer types distribution
  const customerTypeDistribution = useMemo(() => {
    const distribution = {};

    factBanHang.forEach((row) => {
      const customer = customerByKey.get(row.KhachHangKey);
      const time = timeByKey.get(row.ThoiGianKey);
      if (!customer || !time) return;

      // Apply time filters
      if (selectedYears.length > 0 && !selectedYears.includes(String(time.Nam))) {
        return;
      }
      if (selectedQuarters.length > 0 && !selectedQuarters.includes(String(time.Quy))) {
        return;
      }
      if (selectedMonths.length > 0 && !selectedMonths.includes(String(time.Thang))) {
        return;
      }

      // Apply location filters
      const location = locationByKey.get(customer.DiaDiem);
      if (selectedStates.length > 0 && location && !selectedStates.includes(location.Bang)) {
        return;
      }
      if (selectedCities.length > 0 && location && !selectedCities.includes(location.ThanhPho)) {
        return;
      }

      const type = customer.LoaiKhachHang;
      if (!distribution[type]) {
        distribution[type] = {
          type: type,
          count: 0,
          totalRevenue: 0,
          customers: new Set()
        };
      }
      distribution[type].customers.add(row.KhachHangKey);
      distribution[type].totalRevenue += row.SoTienBanRa;
    });

    return Object.values(distribution)
      .map(item => ({
        ...item,
        customerCount: item.customers.size
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [customerByKey, timeByKey, locationByKey, selectedStates, selectedCities, selectedYears, selectedQuarters, selectedMonths]);

  // REQUEST 6: Get all customers with their location
  const customerLocationData = useMemo(() => {
    const customers = new Map();

    factBanHang.forEach((row) => {
      const customer = customerByKey.get(row.KhachHangKey);
      const time = timeByKey.get(row.ThoiGianKey);
      if (!customer || !time) return;

      // Apply time filters
      if (selectedYears.length > 0 && !selectedYears.includes(String(time.Nam))) {
        return;
      }
      if (selectedQuarters.length > 0 && !selectedQuarters.includes(String(time.Quy))) {
        return;
      }
      if (selectedMonths.length > 0 && !selectedMonths.includes(String(time.Thang))) {
        return;
      }

      // Apply location filters
      const location = locationByKey.get(customer.DiaDiem);
      if (selectedStates.length > 0 && location && !selectedStates.includes(location.Bang)) {
        return;
      }
      if (selectedCities.length > 0 && location && !selectedCities.includes(location.ThanhPho)) {
        return;
      }

      if (!customers.has(row.KhachHangKey)) {
        customers.set(row.KhachHangKey, {
          id: row.KhachHangKey,
          name: customer.TenKH,
          type: customer.LoaiKhachHang,
          state: location?.Bang || "Unknown",
          city: location?.ThanhPho || "Unknown",
          totalRevenue: 0,
          totalOrders: 0
        });
      }

      const customerData = customers.get(row.KhachHangKey);
      customerData.totalRevenue += row.SoTienBanRa;
      customerData.totalOrders += row.SoLuong;
    });

    return Array.from(customers.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [customerByKey, timeByKey, locationByKey, selectedStates, selectedCities, selectedYears, selectedQuarters, selectedMonths]);

  // Selected customer details
  const selectedCustomerDetail = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customerLocationData.find(c => c.id === parseInt(selectedCustomerId));
  }, [selectedCustomerId, customerLocationData]);

  // Pagination
  const totalPages = Math.ceil(customerLocationData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return customerLocationData.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [customerLocationData, currentPage]);

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const resetPagination = () => {
    setCurrentPage(1);
  };

  // Chart option for customer types
  const customerTypeChartOption = useMemo(() => {
    const labels = customerTypeDistribution.map(item => item.type);
    const values = customerTypeDistribution.map(item => item.customerCount);
    const colors = ["#2f7ccc", "#1e8f78", "#d97706"];

    return {
      tooltip: { trigger: "item" },
      legend: { orient: "vertical", left: "left" },
      series: [
        {
          name: "Số khách hàng",
          type: "pie",
          radius: "50%",
          data: labels.map((label, idx) => ({
            value: values[idx],
            name: label
          })),
          itemStyle: { borderRadius: 8, borderWidth: 2, borderColor: "#fff" },
          colors: colors
        }
      ]
    };
  }, [customerTypeDistribution]);

  return (
    <section className="customer-page">
      <header className="customer-page__header">
        <h1>Phân tích Khách hàng</h1>
      </header>

      {/* Time Drill-down Controls */}
      <section className="customer-olap-controls">
        <div className="olap-group">
          <h3>⬇️ Drill-down (Thời gian)</h3>
          <div className="olap-buttons">
            <button
              className={`olap-btn ${timeLevel === "year" ? "olap-btn--active" : ""}`}
              onClick={() => {
                setTimeLevel("year");
                resetPagination();
              }}
            >
              Năm
            </button>
            <button
              className={`olap-btn ${timeLevel === "quarter" ? "olap-btn--active" : ""}`}
              onClick={() => {
                setTimeLevel("quarter");
                resetPagination();
              }}
            >
              Quý
            </button>
            <button
              className={`olap-btn ${timeLevel === "month" ? "olap-btn--active" : ""}`}
              onClick={() => {
                setTimeLevel("month");
                resetPagination();
              }}
            >
              Tháng
            </button>
          </div>
        </div>
      </section>

      {/* Dice Filters */}
      <section className="customer-filters">
        <h3>🎲 Bộ lọc (tùy chọn)</h3>
        <div className="customer-filters__grid">
          <MultiSelect
            label="Tỉnh"
            values={selectedStates}
            options={stateOptions}
            onChange={(values) => {
              setSelectedStates(values);
              setSelectedCities([]);
              resetPagination();
            }}
            placeholder="Tất cả"
          />
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
          {timeLevel === "year" && (
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
          )}
          {timeLevel === "quarter" && (
            <>
              <MultiSelect
                label="Năm"
                values={selectedYears}
                options={yearOptions}
                onChange={(values) => {
                  setSelectedYears(values);
                  setSelectedQuarters([]);
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
                  resetPagination();
                }}
                placeholder="Tất cả"
              />
            </>
          )}
          {timeLevel === "month" && (
            <>
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
            </>
          )}
        </div>
      </section>

      <div className="customer-layout">
        {/* LEFT: Customer List (Request 6) */}
        <section className="customer-section customer-section--left">
          <h2>🧑‍💼 Khách hàng (click để chọn)</h2>
          <div className="customer-table-wrapper">
            <table className="customer-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Loại</th>
                  <th>Tỉnh</th>
                  <th>Thành phố</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length > 0 ? (
                  paginatedData.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`customer-row ${selectedCustomerId === row.id ? "customer-row--selected" : ""}`}
                      onClick={() => setSelectedCustomerId(row.id)}
                    >
                      <td className="text-bold">{row.name}</td>
                      <td>{row.type}</td>
                      <td>{row.state}</td>
                      <td>{row.city}</td>
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
            <div className="customer-pagination">
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
        </section>

        {/* RIGHT: Customer Details + Types */}
        <section className="customer-section customer-section--right">
          {selectedCustomerDetail ? (
            <>
              <div className="customer-detail">
                <h3>� Thông tin khách hàng</h3>
                <div className="customer-detail__info">
                  <div className="info-item">
                    <span className="info-label">Tên:</span>
                    <span className="info-value">{selectedCustomerDetail.name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Loại:</span>
                    <span className="info-value">{selectedCustomerDetail.type}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Tỉnh:</span>
                    <span className="info-value">{selectedCustomerDetail.state}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Thành phố:</span>
                    <span className="info-value">{selectedCustomerDetail.city}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Doanh thu:</span>
                    <span className="info-value">{formatCurrency(selectedCustomerDetail.totalRevenue)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Số đơn hàng:</span>
                    <span className="info-value">{formatNumber(selectedCustomerDetail.totalOrders)}</span>
                  </div>
                </div>
              </div>

              <div className="customer-divider"></div>

              <div className="customer-type-distribution">
                <h3>🏷️ Loại khách hàng</h3>
                <div className="customer-table-wrapper">
                  <table className="customer-table customer-table--compact">
                    <thead>
                      <tr>
                        <th>Loại</th>
                        <th>Số khách</th>
                        <th>Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerTypeDistribution.length > 0 ? (
                        customerTypeDistribution.map((item, idx) => (
                          <tr key={idx}>
                            <td className="text-bold">{item.type}</td>
                            <td className="text-right">{formatNumber(item.customerCount)}</td>
                            <td className="text-right">{formatCurrency(item.totalRevenue)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="text-center empty-message">
                            Không có dữ liệu
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="customer-placeholder">
              <p>👆 Chọn khách hàng từ bảng bên trái để xem thông tin chi tiết</p>
            </div>
          )}
        </section>
      </div>

      {/* Request 9: Customer Type Classification Chart */}
      <section className="customer-section">
        <h2>📊 Phân loại khách hàng: Du lịch, Bưu điện, Cả hai</h2>
        <div className="customer-chart-wrapper">
          <ReactECharts option={customerTypeChartOption} style={{ height: "350px" }} />
        </div>
      </section>

      {/* Summary Stats */}
      <section className="customer-section">
        <div className="customer-summary">
          <div className="summary-card">
            <p>Tổng khách hàng</p>
            <h3>{formatNumber(customerLocationData.length)}</h3>
          </div>
          <div className="summary-card">
            <p>Tổng doanh thu</p>
            <h3>{formatCurrency(customerLocationData.reduce((sum, item) => sum + item.totalRevenue, 0))}</h3>
          </div>
          <div className="summary-card">
            <p>Tổng đơn hàng</p>
            <h3>{formatNumber(customerLocationData.reduce((sum, item) => sum + item.totalOrders, 0))}</h3>
          </div>
        </div>
      </section>
    </section>
  );
}
