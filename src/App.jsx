import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import "./App.css";

/* =========================
   HULPFUNCTIES
========================= */

function parsePrice(value) {
  if (value === undefined || value === null) return 0;

  // Als het al een number is
  if (typeof value === "number") return value;

  const str = String(value).trim();

  // Als komma aanwezig → Europese notatie
  if (str.includes(",")) {
    return Number(
      str
        .replace(/\s/g, "")
        .replace("€", "")
        .replace(/\./g, "")
        .replace(",", ".")
    );
  }

  // Anders normale notatie
  return Number(str.replace("€", ""));
}

function roundUpTo95(price) {
  const floor = Math.floor(price);
  const target = floor + 0.95;
  return price <= target
    ? Number(target.toFixed(2))
    : Number((floor + 1 + 0.95).toFixed(2));
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

  const [levBTWMode, setLevBTWMode] = useState("excl");
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });
  const [statusFilter, setStatusFilter] = useState("all");

  const BTW_PERCENTAGE = 21;

  /* =========================
     BESTANDEN INLEZEN
  ========================= */

  const handleWebshopFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);
      setWebshopData(data);
      setWebshopColumns(Object.keys(data[0] || {}));
    };
    reader.readAsArrayBuffer(file);
  };

  const handleLeverancierFile = (file) => {
    const isCSV = file.name.toLowerCase().endsWith(".csv");

    if (isCSV) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          setLeverancierData(res.data);
          setLeverancierColumns(Object.keys(res.data[0] || {}));
        }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const workbook = XLSX.read(e.target.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        setLeverancierData(data);
        setLeverancierColumns(Object.keys(data[0] || {}));
      };
      reader.readAsArrayBuffer(file);
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
        parsePrice(item[mapping.levPrijs])
      );
    });

    const output = webshopData.map((item) => {
      const artikelnummer = String(item[mapping.wsArtikel]);
      const naam = item[mapping.wsNaam] || "";

      const oudePrijsRaw = item[mapping.wsPrijs];
      const oudePrijs = parsePrice(oudePrijsRaw);

      if (!leverancierMap.has(artikelnummer)) {
        return {
          artikelnummer,
          naam,
          oudePrijs: oudePrijsRaw,
          nieuwePrijs: "",
          status: "notfound"
        };
      }

      const leverancierPrijs = leverancierMap.get(artikelnummer);
      if (isNaN(leverancierPrijs)) {
        return {
          artikelnummer,
          naam,
          oudePrijs: oudePrijsRaw,
          nieuwePrijs: "",
          status: "notfound"
        };
      }

      const leverancierIncl =
        levBTWMode === "excl"
          ? leverancierPrijs * (1 + BTW_PERCENTAGE / 100)
          : leverancierPrijs;

      const nieuwePrijs = roundUpTo95(leverancierIncl);

      let status;

        if (nieuwePrijs > oudePrijs) {
          status = "higher";
        } else if (nieuwePrijs < oudePrijs) {
          status = "lower";
        } else {
          status = "equal";
        }

      return {
        artikelnummer,
        naam,
        oudePrijs: oudePrijsRaw,
        nieuwePrijs: nieuwePrijs.toLocaleString("nl-NL", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        status
      };
    });

    setResults(output);
    setStatusFilter("all");
  };

  /* =========================
     FILTER + SORT
  ========================= */

  const filteredResults = useMemo(() => {
    let filtered = [...results];

    if (statusFilter !== "all") {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (search) {
      filtered = filtered.filter(r =>
        r.artikelnummer.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
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

  const exportCSV = () => {
    const csv = Papa.unparse(filteredResults, { delimiter: ";" });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "prijs_update.csv");
  };

  /* =========================
     UI
  ========================= */

  return (
    <div className="App">
      <h1>Webshop Prijs Vergelijker</h1>

      <div className="card upload-grid">
        <div>
          <label>Webshop Excel</label>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => e.target.files && handleWebshopFile(e.target.files[0])}
          />
        </div>

        <div>
          <label>Leverancier (Excel of CSV)</label>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => e.target.files && handleLeverancierFile(e.target.files[0])}
          />

          <div style={{ marginTop: 15 }}>
            <strong>Leverancier prijzen zijn:</strong>
            <div>
              <label>
                <input
                  type="radio"
                  name="btwMode"
                  value="excl"
                  checked={levBTWMode === "excl"}
                  onChange={(e) => setLevBTWMode(e.target.value)}
                />
                {" "}Excl. BTW
              </label>
            </div>
            <div>
              <label>
                <input
                  type="radio"
                  name="btwMode"
                  value="incl"
                  checked={levBTWMode === "incl"}
                  onChange={(e) => setLevBTWMode(e.target.value)}
                />
                {" "}Incl. BTW
              </label>
            </div>
          </div>
        </div>
      </div>

      {webshopColumns.length > 0 && leverancierColumns.length > 0 && (
        <div className="card mapping-grid">
          <select onChange={e => setMapping({...mapping, wsArtikel: e.target.value})}>
            <option value="">Webshop Nummer</option>
            {webshopColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <select onChange={e => setMapping({...mapping, wsNaam: e.target.value})}>
            <option value="">Webshop Naam</option>
            {webshopColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <select onChange={e => setMapping({...mapping, wsPrijs: e.target.value})}>
            <option value="">Webshop Prijs</option>
            {webshopColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <select onChange={e => setMapping({...mapping, levArtikel: e.target.value})}>
            <option value="">Leverancier Nummer</option>
            {leverancierColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <select onChange={e => setMapping({...mapping, levPrijs: e.target.value})}>
            <option value="">Leverancier Prijs</option>
            {leverancierColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <button onClick={comparePrices}>Vergelijken</button>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="card stats">
            <div className={`stat-box ${statusFilter==="all"?"active":""}`} onClick={()=>setStatusFilter("all")}>
              Totaal: {results.length}
            </div>
            <div className={`stat-box green-box ${statusFilter==="higher"?"active":""}`}
                onClick={()=>setStatusFilter("higher")}>
              Hoger: {results.filter(r=>r.status==="higher").length}
            </div>

            <div className={`stat-box blue-box ${statusFilter==="equal"?"active":""}`}
                onClick={()=>setStatusFilter("equal")}>
              Gelijk: {results.filter(r=>r.status==="equal").length}
            </div>

            <div className={`stat-box orange-box ${statusFilter==="lower"?"active":""}`}
                onClick={()=>setStatusFilter("lower")}>
              Lager: {results.filter(r=>r.status==="lower").length}
            </div>
            <div className={`stat-box red-box ${statusFilter==="notfound"?"active":""}`} onClick={()=>setStatusFilter("notfound")}>
              Niet gevonden: {results.filter(r=>r.status==="notfound").length}
            </div>
          </div>

          <div className="card">
            <input
              type="text"
              placeholder="Zoek artikelnummer..."
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
            />
            <button onClick={exportCSV}>Export CSV</button>
          </div>

          <div className="card table-container">
            <table>
              <thead>
                <tr>
                  <th onClick={()=>requestSort("artikelnummer")}>Artikelnummer</th>
                  <th>Naam</th>
                  <th>Oude prijs</th>
                  <th>Nieuwe prijs</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r,i)=>(
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
        </>
      )}
    </div>
  );
}

export default App;