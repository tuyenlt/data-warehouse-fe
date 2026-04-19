
# Data Warehouse Frontend (React)

## Overview
This is the frontend for the Data Warehouse & Mining project, built with React and Vite. It provides BI/OLAP dashboards and analytics using local JSON data and connects to the backend OLAP API.

## Tech Stack
- React 19
- Vite 8
- ECharts (echarts-for-react)
- React Router
- Local star-schema-like data (src/data)

## Getting Started
```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

## Main Routes
- `/dashboard`: Dashboard page (KPI, trend, product, filters)
- `/sale`: Sales analytics page
- `/customer`: Customer analytics (placeholder)
- `/inventory`: Inventory analytics (placeholder)

## Features
- KPI cards: Revenue, Order Quantity, Inventory Quantity
- Time trend chart
- Product top chart
- Filters by time and location
- Uses `SoTienBanRa` as revenue measure

## Documentation
- See `docs/dw-schema.md` for Data Warehouse schema
- See `docs/idb-schema.md` for Integrated Database schema

## Sales Analytics

- 3 charts:
  - Revenue by Time
  - Quantity by Time
  - Revenue by Product
- Context menu (right click):
  - Roll up / Drill down (time hierarchy)
  - Pivot / Unpivot
  - Open Slice & Dice panel
- Time hierarchy: Month -> Quarter -> Year
- Sales detail table keeps customer name (`TenKH`) and fact measures only
- Fact measures:
  - `SoLuong`
  - `SoTienBanRa`
  - `SoTienLai`
  - `SoLaiTrungBinh`

## Data Files

Main files currently used by pages:

- `src/data/dim_thoi_gian.json`
- `src/data/dim_dia_diem.json`
- `src/data/dim_cua_hang.json`
- `src/data/dim_khach_hang.json`
- `src/data/dim_mat_hang.json`
- `src/data/fact_ban_hang.json`
- `src/data/fact_ton_kho.json`

Additional dataset available:

- `src/data/fact_hanh_vi.json`
