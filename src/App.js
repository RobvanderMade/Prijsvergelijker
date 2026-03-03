import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import "./App.css";

/* =========================
   PRIJS FUNCTIES
========================= */

function addBTW(price) {
  return price * 1.21;
}

function roundUpTo95(price) {
  const floor = Math.floor(price);
  const target = floor + 0.95;
  if (price <= target) return parseFloat(target.toFixed(2));
  return parseFloat((floor + 1 + 0.95).toFixed(2));
}

function App() {
  const [webshopData, setWebshopData] = useState([]);
  const [leverancierData, setLeverancierData] = useState([]);

  const [webshopColumns, setWebshopColumns] = useState([]);
  const [leverancierColumns, setLeverancierColumns] = useState([]);

  const [mapping, setMapping] = useState({
    wsArtikel: "",
    wsNaam: "",
    wsPrijs: "",
    levArtikel: "",
    levPrijs: ""
  });

  const [results, setResults] = useState([]);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });
  const [statusFilter, setStatusFilter] = useState("all");
  const [dragActive, setDragActive] = useState(null);

  /* =========================
     BESTAND INLEZEN
  ========================= */

  const parseExcel = (file, setterData, setterColumns) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);
      setterData(data);
      setterColumns(Object.keys(data[0] || {}));
    };
    reader.readAsBinaryString(file);
  };

  const parseCSV = (file, setterData, setterColumns) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setterData(res.data);
        setterColumns(Object.keys(res.data[0] || {}));
      }
    });
  };

  const handleFile = (file, type) => {
    if (!file) return;

    const isCSV = file.name.toLowerCase().endsWith(".csv");

    if (type === "webshop") {
      isCSV
        ? parseCSV(file, setWebshopData, setWebshopColumns)
        : parseExcel(file, setWebshopData, setWebshopColumns);
    } else {
      isCSV
        ? parseCSV(file, setLeverancierData, setLeverancierColumns)
        : parseExcel(file, setLeverancierData, setLeverancierColumns);
    }
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);

    if (e.dataTransfer.files?.length) {
      handleFile(e.dataTransfer.files[0], type);
      e.dataTransfer.clearData();
    }
  };

  /* =========================
     VERGELIJKEN
  ========================= */

  const comparePrices = () => {
    if (!mapping.wsArtikel || !mapping.wsPrijs || !mapping.levArtikel || !mapping.levPrijs) {
      alert("Selecteer eerst alle kolommen.");
      return;
    }

    const leverancierMap = new Map();
    leverancierData.forEach((item) => {
      leverancierMap.set(
        String(item[mapping.levArtikel]),
        parseFloat(item[mapping.levPrijs])
      );
    });

    const output = webshopData.map((item) => {
      const artikelnummer = String(item[mapping.wsArtikel]);
      const naam = item[mapping.wsNaam] || "";
      const oudePrijs = parseFloat(item[mapping.wsPrijs]);

      if (!leverancierMap.has(artikelnummer)) {
        return { artikelnummer, naam, oudePrijs, nieuwePrijs: "", status: "notfound" };
      }

      const leverancierExcl = leverancierMap.get(artikelnummer);
      if (!leverancierExcl || isNaN(leverancierExcl)) {
        return { artikelnummer, naam, oudePrijs, nieuwePrijs: "", status: "notfound" };
      }

      const leverancierIncl = addBTW(leverancierExcl);
      const nieuwePrijs = roundUpTo95(leverancierIncl);

      let status = "lower";
      if (nieuwePrijs > oudePrijs) status = "higher";

      return {
        artikelnummer,
        naam,
        oudePrijs: oudePrijs.toFixed(2),
        nieuwePrijs: nieuwePrijs.toFixed(2),
        status,
      };
    });

    setResults(output);
    setStatusFilter("all");
  };

  /* =========================
     FILTER + SORTERING
  ========================= */

  const filteredResults = useMemo(() => {
    let filtered = results;

    if (statusFilter !== "all") {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (search) {
      filtered = filtered.filter(r =>
        r.artikelnummer.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [results, search, sortConfig, statusFilter]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  /* =========================
     EXPORT CSV
  ========================= */

  const exportCSV = () => {
    const csv = Papa.unparse(filteredResults, { delimiter: ";" });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "prijs_update.csv");
  };

  /* =========================
     STATS
  ========================= */

  const stats = {
    total: results.length,
    notfound: results.filter(r => r.status === "notfound").length,
    higher: results.filter(r => r.status === "higher").length,
    lower: results.filter(r => r.status === "lower").length
  };

  /* =========================
     UI
  ========================= */

  return (
    <div className="App">
      <h1>Webshop Prijs Vergelijker</h1>

      <div className="card upload-grid">

        <div
          className={`dropzone ${dragActive === "webshop" ? "active" : ""}`}
          onDragEnter={() => setDragActive("webshop")}
          onDragLeave={() => setDragActive(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, "webshop")}
        >
          <label>Webshop bestand (CSV of Excel)</label>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => handleFile(e.target.files[0], "webshop")}
          />
          <p>Sleep bestand hierheen of klik om te kiezen</p>
        </div>

        <div
          className={`dropzone ${dragActive === "leverancier" ? "active" : ""}`}
          onDragEnter={() => setDragActive("leverancier")}
          onDragLeave={() => setDragActive(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, "leverancier")}
        >
          <label>Leverancier bestand (CSV of Excel, excl. BTW)</label>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => handleFile(e.target.files[0], "leverancier")}
          />
          <p>Sleep bestand hierheen of klik om te kiezen</p>
        </div>

      </div>

      {results.length > 0 && (
        <>
          <div className="card stats">
            <div onClick={() => setStatusFilter("all")}>Totaal: {stats.total}</div>
            <div onClick={() => setStatusFilter("notfound")}>Niet gevonden: {stats.notfound}</div>
            <div onClick={() => setStatusFilter("higher")}>Prijs hoger: {stats.higher}</div>
            <div onClick={() => setStatusFilter("lower")}>Prijs lager/gelijk: {stats.lower}</div>
          </div>

          <div className="card">
            <input
              type="text"
              placeholder="Zoek artikelnummer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button onClick={exportCSV}>Export CSV</button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;