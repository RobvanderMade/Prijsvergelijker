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

  /* =========================
     BESTANDEN INLEZEN
  ========================= */

  const handleWebshopFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);
      setWebshopData(data);
      setWebshopColumns(Object.keys(data[0] || {}));
    };
    reader.readAsBinaryString(file);
  };

  const handleLeverancierFile = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setLeverancierData(res.data);
        setLeverancierColumns(Object.keys(res.data[0] || {}));
      },
    });
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
     STATISTIEKEN
  ========================= */

  const stats = {
    total: results.length,
    notfound: results.filter(r => r.status === "notfound").length,
    higher: results.filter(r => r.status === "higher").length,
    lower: results.filter(r => r.status === "lower").length
  };

  /* =========================
     EXPORT
  ========================= */

  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredResults);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Prijsupdate");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    saveAs(blob, "prijs_update.xlsx");
  };

  /* =========================
     UI
  ========================= */

  return (
    <div className="App">
      <h1>Webshop Prijs Vergelijker</h1>

      {/* Upload */}
      <div className="card upload-grid">
        <div>
          <label>Webshop Excel</label>
          <input type="file" accept=".xlsx" onChange={(e) => handleWebshopFile(e.target.files[0])} />
        </div>

        <div>
          <label>Leverancier CSV (excl. BTW)</label>
          <input type="file" accept=".csv" onChange={(e) => handleLeverancierFile(e.target.files[0])} />
        </div>
      </div>

      {/* Mapping */}
      {(webshopColumns.length > 0 || leverancierColumns.length > 0) && (
        <div className="card mapping-grid">
          <select onChange={e => setMapping({...mapping, wsArtikel: e.target.value})}>
            <option value="">Webshop Nummer</option>
            {webshopColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <select onChange={e => setMapping({...mapping, wsNaam: e.target.value})}>
            <option value="">Webshop Productnaam</option>
            {webshopColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <select onChange={e => setMapping({...mapping, wsPrijs: e.target.value})}>
            <option value="">Webshop Prijs incl. BTW</option>
            {webshopColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <select onChange={e => setMapping({...mapping, levArtikel: e.target.value})}>
            <option value="">Leverancier Nummer</option>
            {leverancierColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <select onChange={e => setMapping({...mapping, levPrijs: e.target.value})}>
            <option value="">Leverancier Prijs excl. BTW(excl)</option>
            {leverancierColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <button className="primary" onClick={comparePrices}>Vergelijken</button>
        </div>
      )}

      {/* Dashboard Filters */}
      {results.length > 0 && (
        <div className="card stats">
          <div className={`stat-box ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>
            Totaal: {stats.total}
          </div>

          <div className={`stat-box red-box ${statusFilter === "notfound" ? "active" : ""}`} onClick={() => setStatusFilter("notfound")}>
            Niet gevonden: {stats.notfound}
          </div>

          <div className={`stat-box green-box ${statusFilter === "higher" ? "active" : ""}`} onClick={() => setStatusFilter("higher")}>
            Prijs hoger: {stats.higher}
          </div>

          <div className={`stat-box orange-box ${statusFilter === "lower" ? "active" : ""}`} onClick={() => setStatusFilter("lower")}>
            Prijs lager/gelijk: {stats.lower}
          </div>
        </div>
      )}

      {/* Zoek + Export */}
      {results.length > 0 && (
        <div className="card">
          <input
            type="text"
            placeholder="Zoek artikelnummer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="secondary" onClick={exportExcel}>Export Excel</button>
        </div>
      )}

      {/* Tabel */}
      {results.length > 0 && (
        <div className="card table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => requestSort("artikelnummer")}>Artikelnummer</th>
                <th onClick={() => requestSort("naam")}>Naam</th>
                <th onClick={() => requestSort("oudePrijs")}>Oude prijs</th>
                <th onClick={() => requestSort("nieuwePrijs")}>Nieuwe prijs</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((r, i) => (
                <tr key={i} className={r.status}>
                  <td>{r.artikelnummer}</td>
                  <td>{r.naam}</td>
                  <td>{r.oudePrijs}</td>
                  <td>{r.nieuwePrijs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;