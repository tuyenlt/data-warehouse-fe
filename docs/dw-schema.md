# 🏢 Data Warehouse (DW) Schema

## 🧠 Overview

This document describes the **Data Warehouse (DW)** schema.

* The DW is designed for **analytics (OLAP)**, not transactional operations.
* Data is **denormalized** and organized using a **star schema**.
* Data is loaded from the **Integrated Database (IDB)** via ETL processes.
* Tables are divided into:

  * **Dimension tables (Dim_*)**
  * **Fact tables (Fact_*)**

---

## 🌟 Schema Type

This DW follows a **Star Schema**:

* Fact tables are at the center
* Dimension tables surround and describe facts
* Optimized for:

  * Aggregation
  * Drill-down / Roll-up
  * Slice / Dice

---

## 🗂️ Dimension Tables

### 1. Dim_MatHang (Product Dimension)

| Column     | Description         |
| ---------- | ------------------- |
| MatHangKey | Surrogate key       |
| MoTa       | Product description |
| Gia        | Base price          |
| KichThuoc  | Size                |
| TrongLuong | Weight              |

---

### 2. Dim_DiaDiem (Location Dimension)

| Column     | Description  |
| ---------- | ------------ |
| DiaDiemKey | Location key |
| ThanhPho   | City         |
| Bang       | State/Region |

---

### 3. Dim_ThoiGian (Time Dimension)

| Column      | Description   |
| ----------- | ------------- |
| ThoiGianKey | Surrogate key |
| Thang       | Month         |
| Quy         | Quarter       |
| Nam         | Year          |

👉 Used for time-based aggregation (Year → Quarter → Month)

---

### 4. Dim_Khach_Hang (Customer Dimension)

| Column         | Description        |
| -------------- | ------------------ |
| KhachHangKey   | Surrogate key      |
| TenKH          | Customer name      |
| DiaDiem        | Location reference |
| NgayDatDauTien | First order date   |
| LoaiKhachHang  | Customer type      |

---

### 5. Dim_CuaHang (Store Dimension)

| Column      | Description      |
| ----------- | ---------------- |
| CuaHangKey  | Store key        |
| DiaDiemKey  | FK → Dim_DiaDiem |
| SoDienThoai | Phone number     |

---

## 📊 Fact Tables

### 1. Fact_TonKho (Inventory Fact)

| Column      | Description        |
| ----------- | ------------------ |
| CuaHangKey  | FK → Dim_CuaHang   |
| MatHangKey  | FK → Dim_MatHang   |
| ThoiGianKey | FK → Dim_ThoiGian  |
| SoLuongTon  | Inventory quantity |
| TrongLuong  | Total weight       |
| GiaTri      | Inventory value    |

👉 Grain: **Per product per store per time**

---

### 2. Fact_BanHang (Sales Fact)

| Column       | Description         |
| ------------ | ------------------- |
| MatHangKey   | FK → Dim_MatHang    |
| KhachHangKey | FK → Dim_Khach_Hang |
| ThoiGianKey  | FK → Dim_ThoiGian   |
| SoLuong      | Quantity sold       |
| GiaBan       | Selling price       |
| LoiNhuan     | Profit              |
| LoiNhuanTB   | Average profit      |

👉 Grain: **Per product per customer per time**

---

### 3. Fact_HanhVi (Customer Behavior Fact)

| Column          | Description               |
| --------------- | ------------------------- |
| KhachHangKey    | FK → Dim_Khach_Hang       |
| ThoiGianKey     | FK → Dim_ThoiGian         |
| SoMatHang       | Number of products bought |
| TongThu         | Total revenue             |
| GiaTB           | Average price             |
| NgayMuaHGanNhat | Last purchase date        |

👉 Grain: **Per customer per time**

---

## 🔗 Relationships

* Fact tables reference dimension tables via foreign keys
* No direct relationships between fact tables
* Dimensions can be reused across multiple facts

---

## ⚙️ Key Characteristics for AI Agent

* This is a **Data Warehouse (DW)**, not OLTP
* Data is:

  * Aggregated
  * Historical
  * Read-optimized
* Keys like `MatHangKey`, `KhachHangKey` are **surrogate keys**
* Fact tables contain **measures (numeric values)** for analysis

---

## 📈 Supported OLAP Operations

This schema supports:

* **Drill-down / Roll-up** (Time hierarchy)
* **Slice / Dice** (filter by dimensions)
* **Aggregation** (SUM, AVG, COUNT)
* **Trend analysis over time**

---

## 🔄 Mapping from IDB (Source System)

* MatHang → Dim_MatHang
* KhachHang → Dim_Khach_Hang
* CuaHang → Dim_CuaHang
* VanPhongDaiDien → Dim_DiaDiem
* DonDatHang + MatHangDuocDat → Fact_BanHang
* MatHangLuuTru → Fact_TonKho

---

## 🎯 Notes

* Fact tables define the **business process**:

  * Sales
  * Inventory
  * Customer behavior
* Dimensions provide **context** for analysis
* Designed for BI tools and dashboards

---
