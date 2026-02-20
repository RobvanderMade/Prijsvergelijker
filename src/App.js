import React, { useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import "./App.css";

/* =========================
   PRIJS FUNCTIES
========================= */

// 21% BTW toevoegen
function addBTW(price) {
  return price * 1.21;
}

// Afronden naar boven op ,95
function roundUpTo95(price) {
  const floor = Math.floor(price);
  const target = floor + 0.95;

  if (price <= target) {
    return parseFloat(target.toFixed(2));
  } else {
    return parseFloat((floor + 1 + 0.95).toFixed(2));
  }
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

  /* =========================
     BESTAND INLEZEN
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
        return {
          artikelnummer,
          naam,
          oudePrijs,
          nieuwePrijs: "",
          status: "notfound",
        };
      }

      const leverancierExcl = leverancierMap.get(artikelnummer);

      if (!leverancierExcl || isNaN(leverancierExcl)) {
        return {
          artikelnummer,
          naam,
          oudePrijs,
          nieuwePrijs: "",
          status: "notfound",
        };
      }

      // 1️⃣ BTW toevoegen (21%)
      const leverancierIncl = addBTW(leverancierExcl);

      // 2️⃣ Afronden naar boven op ,95
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
  };

  /* =========================
     EXPORT EXCEL
  ========================= */

  const exportExcel = () => {
    const exportData = results.map(r => ({
      Artikelnummer: r.artikelnummer,
      Naam: r.naam,
      Oude_prijs: r.oudePrijs,
      Nieuwe_prijs: r.nieuwePrijs
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Prijsupdate");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, "prijs_update.xlsx");
  };

  /* =========================
     UI
  ========================= */

  return (
    <div className="App">
      <h1>Prijs Vergelijker</h1>

      <div>
        <label>
          Webshop Excel:
          <input type="file" accept=".xlsx" onChange={(e) => handleWebshopFile(e.target.files[0])} />
        </label>

        <label>
          Leverancier CSV (excl. BTW):
          <input type="file" accept=".csv" onChange={(e) => handleLeverancierFile(e.target.files[0])} />
        </label>
      </div>

      {webshopColumns.length > 0 && (
        <div>
          <h3>Webshop kolommen koppelen</h3>
          <select onChange={e => setMapping({...mapping, wsArtikel: e.target.value})}>
            <option value="">Artikelnummer</option>
            {webshopColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <select onChange={e => setMapping({...mapping, wsNaam: e.target.value})}>
            <option value="">Naam</option>
            {webshopColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <select onChange={e => setMapping({...mapping, wsPrijs: e.target.value})}>
            <option value="">Prijs</option>
            {webshopColumns.map(col => <option key={col}>{col}</option>)}
          </select>
        </div>
      )}

      {leverancierColumns.length > 0 && (
        <div>
          <h3>Leverancier kolommen koppelen</h3>
          <select onChange={e => setMapping({...mapping, levArtikel: e.target.value})}>
            <option value="">Artikelnummer</option>
            {leverancierColumns.map(col => <option key={col}>{col}</option>)}
          </select>

          <select onChange={e => setMapping({...mapping, levPrijs: e.target.value})}>
            <option value="">Prijs (excl BTW)</option>
            {leverancierColumns.map(col => <option key={col}>{col}</option>)}
          </select>
        </div>
      )}

      <button onClick={comparePrices}>Vergelijken</button>

      {results.length > 0 && (
        <>
          <button onClick={exportExcel}>Export Excel</button>

          <table>
            <thead>
              <tr>
                <th>Artikelnummer</th>
                <th>Naam</th>
                <th>Oude prijs</th>
                <th>Nieuwe prijs</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr
                  key={i}
                  className={
                    r.status === "notfound"
                      ? "red"
                      : r.status === "higher"
                      ? "green"
                      : "orange"
                  }
                >
                  <td>{r.artikelnummer}</td>
                  <td>{r.naam}</td>
                  <td>{r.oudePrijs}</td>
                  <td>{r.nieuwePrijs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default App;