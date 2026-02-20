import React, { useState } from "react";
import Papa from "papaparse";
import { saveAs } from "file-saver";
import "./App.css";

function App() {
  const [webshopData, setWebshopData] = useState([]);
  const [leverancierData, setLeverancierData] = useState([]);
  const [results, setResults] = useState([]);

  const handleFile = (file, setData) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setData(results.data);
      },
    });
  };

  const comparePrices = () => {
    const leverancierMap = {};
    leverancierData.forEach((item) => {
      leverancierMap[item.partnumber] = parseFloat(item.prijs);
    });

    const updates = webshopData.map((product) => {
      const leverancierPrijs = leverancierMap[product.partnumber];
      const webshopPrijs = parseFloat(product.prijs);

      if (leverancierPrijs && leverancierPrijs !== webshopPrijs) {
        return {
          partnumber: product.partnumber,
          naam: product.naam,
          webshopPrijs: webshopPrijs.toFixed(2),
          leverancierPrijs: leverancierPrijs.toFixed(2),
          nieuwePrijs: (leverancierPrijs * 1.3).toFixed(2),
        };
      }
      return null;
    }).filter(Boolean);

    setResults(updates);
  };

  const downloadCSV = () => {
    const csv = Papa.unparse(results);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "prijsupdates.csv");
  };

  return (
    <div className="App">
      <h1>Prijsvergelijker</h1>

      <div className="upload-section">
        <label>
          Webshop bestand
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFile(e.target.files[0], setWebshopData)}
          />
        </label>

        <label>
          Leverancier bestand
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFile(e.target.files[0], setLeverancierData)}
          />
        </label>
      </div>

      <button onClick={comparePrices}>Vergelijk Prijzen</button>

      {results.length > 0 && (
        <>
          <h2>Resultaten</h2>
          <table>
            <thead>
              <tr>
                <th>Partnumber</th>
                <th>Naam</th>
                <th>Webshop Prijs</th>
                <th>Leverancier Prijs</th>
                <th>Update Prijs</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{r.partnumber}</td>
                  <td>{r.naam}</td>
                  <td>{r.webshopPrijs}</td>
                  <td>{r.leverancierPrijs}</td>
                  <td>{r.nieuwePrijs}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={downloadCSV}>Download CSV</button>
        </>
      )}
    </div>
  );
}

export default App;
