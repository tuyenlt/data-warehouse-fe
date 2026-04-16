# 📦 Integrated Database (IDB) Schema

## 🧠 Overview

This document describes the **Integrated Database (IDB)** schema used as the **source system** for the Data Warehouse (DW).

* The IDB stores **operational data (OLTP)**.
* It is the **input for ETL pipelines** into the Data Warehouse.
* Data is normalized and contains transactional details.

---

## 🗂️ Entities and Tables

### 1. Office (VanPhongDaiDien)

Represents representative offices by city.

| Column      | Type         | Description           |
| ----------- | ------------ | --------------------- |
| MaThanhPho  | VARCHAR(20)  | Primary key (City ID) |
| TenThanhPho | VARCHAR(255) | City name             |
| DiaChiVP    | VARCHAR(255) | Office address        |
| Bang        | VARCHAR(50)  | State/Region          |
| ThoiGian    | DATETIME     | Created timestamp     |

---

### 2. Store (CuaHang)

Represents stores belonging to a city.

| Column      | Type        | Description          |
| ----------- | ----------- | -------------------- |
| MaCuaHang   | BIGINT      | Primary key          |
| MaThanhPho  | VARCHAR(20) | FK → VanPhongDaiDien |
| SoDienThoai | VARCHAR(20) | Phone number         |
| ThoiGian    | DATETIME    | Created timestamp    |

---

### 3. Customer (KhachHang)

Stores customer information.

| Column         | Type         | Description       |
| -------------- | ------------ | ----------------- |
| MaKH           | BIGINT       | Primary key       |
| TenKH          | VARCHAR(100) | Customer name     |
| NgayDatDauTien | DATETIME     | First order date  |
| MaThanhPho     | VARCHAR(20)  | City reference    |
| ThoiGian       | DATETIME     | Created timestamp |

---

### 4. Tourist Customer (KhachDuLich)

Subtype of customer.

| Column       | Type        | Description        |
| ------------ | ----------- | ------------------ |
| MaKH         | BIGINT      | PK, FK → KhachHang |
| HuongDanVien | VARCHAR(50) | Tour guide         |

---

### 5. Postal Customer (KhachBuuDien)

Subtype of customer.

| Column        | Type         | Description        |
| ------------- | ------------ | ------------------ |
| MaKH          | BIGINT       | PK, FK → KhachHang |
| DiaChiBuuDien | VARCHAR(255) | Postal address     |

---

### 6. Product (MatHang)

| Column     | Type          | Description       |
| ---------- | ------------- | ----------------- |
| MaMH       | BIGINT        | Primary key       |
| MoTa       | VARCHAR(MAX)  | Description       |
| Gia        | DECIMAL(18,2) | Price             |
| KichThuoc  | VARCHAR(50)   | Size              |
| TrongLuong | FLOAT         | Weight            |
| ThoiGian   | DATETIME      | Created timestamp |

---

### 7. Inventory (MatHangLuuTru)

Represents stock per store.

| Column     | Type     | Description        |
| ---------- | -------- | ------------------ |
| MaCuaHang  | BIGINT   | FK → Store         |
| MaMH       | BIGINT   | FK → Product       |
| SoLuongTon | INT      | Inventory quantity |
| ThoiGian   | DATETIME | Timestamp          |

Primary Key: (MaCuaHang, MaMH)

---

### 8. Order (DonDatHang)

| Column  | Type     | Description   |
| ------- | -------- | ------------- |
| MaDon   | BIGINT   | Primary key   |
| NgayDat | DATETIME | Order date    |
| MaKH    | BIGINT   | FK → Customer |

---

### 9. Order Detail (MatHangDuocDat)

| Column     | Type          | Description         |
| ---------- | ------------- | ------------------- |
| MaDon      | BIGINT        | FK → Order          |
| MaMH       | BIGINT        | FK → Product        |
| SoLuongDat | INT           | Quantity            |
| Gia        | DECIMAL(18,2) | Price at order time |
| ThoiGian   | DATETIME      | Timestamp           |

Primary Key: (MaDon, MaMH)

---

## 🔗 Relationships

* VanPhongDaiDien → CuaHang (1-N)
* VanPhongDaiDien → KhachHang (1-N)
* KhachHang → KhachDuLich / KhachBuuDien (1-1 subtype)
* CuaHang ↔ MatHang (M-N via Inventory)
* DonDatHang → KhachHang (N-1)
* DonDatHang ↔ MatHang (M-N via Order Detail)

---

## ⚙️ Notes for AI Agent

* This schema represents an **OLTP system (IDB)**, not a Data Warehouse.
* Data is **normalized**, not in star schema.
* Use this as **source for ETL → DW**.
* Inventory (`MatHangLuuTru`) represents current stock, not historical fact.
* Order detail (`MatHangDuocDat`) is the main transactional fact source.

---

## 🎯 Suggested Mapping to Data Warehouse

* Customer → Dim_Customer
* Product → Dim_Product
* Store → Dim_Store
* Time → Dim_Time (derived from dates)
* Order Detail → Fact_Sales
* Inventory → Fact_Inventory

---
