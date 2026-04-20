import React, { useState } from "react";
import html2canvas from "html2canvas";

import jsPDF from "jspdf";

/**
 * Balas‑Hammer (méthode de différence maximale)
 * ‑‑
 * 1. Calculer pour chaque ligne/colonne la pénalité = diff. entre les 2 plus petits coûts.
 * 2. Sélectionner la pénalité max.
 * 3. Dans la ligne/colonne correspondante, choisir la cellule de coût minimal.
 * 4. Allouer min(Offre, Demande).
 * 5. Rayer ligne/colonne épuisée, répéter.
 *
 * Gestion de la dégénérescence si #allocations < m+n‑1, on ajoute des 0 (ε) dans les cases
 *    de coût minimal non encore allouées pour atteindre m+n‑1 allocations.
 */

/******************************
 * Helpers & Algo
 *****************************/

function clone2D(arr) {
  return arr.map((row) => [...row]);
}

function getTwoMin(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  return [sorted[0], sorted[1] ?? sorted[0]];
}

/**
 * Exécute l'algorithme et renvoie un tableau d'étapes ;
 * chaque étape = { allocations, offer, demand, chosen, penalties, note }
 */
function balasHammer(costs, offerOrig, demandOrig) {
  const m = costs.length;
  const n = costs[0].length;
  let offer = [...offerOrig];
  let demand = [...demandOrig];
  const allocations = Array.from({ length: m }, () => Array(n).fill(null));

  const steps = [];

  while (offer.some((o) => o > 0) && demand.some((d) => d > 0)) {
    // 1. pénalités lignes & colonnes
    const rowPen = costs.map((row, i) => {
      if (offer[i] === 0) return -1; // déjà épuisée
      const [min1, min2] = getTwoMin(row.filter((_, j) => demand[j] > 0));
      return min2 - min1;
    });
    const colPen = costs[0].map((_, j) => {
      if (demand[j] === 0) return -1;
      const col = costs.map((row) => row[j]);
      const [min1, min2] = getTwoMin(col.filter((_, i) => offer[i] > 0));
      return min2 - min1;
    });

    const maxRowPen = Math.max(...rowPen);
    const maxColPen = Math.max(...colPen);

    let chosenRow = null,
      chosenCol = null;

    if (maxRowPen >= maxColPen) {
      chosenRow = rowPen.indexOf(maxRowPen);
      // cellule de coût minimal dans cette ligne parmi colonnes dispos
      const minCost = Math.min(
        ...costs[chosenRow].filter((_, j) => demand[j] > 0)
      );
      chosenCol = costs[chosenRow].findIndex(
        (c, j) => c === minCost && demand[j] > 0
      );
    } else {
      chosenCol = colPen.indexOf(maxColPen);
      // coût min dans cette colonne parmi lignes dispos
      const column = costs.map((row) => row[chosenCol]);
      const minCost = Math.min(...column.filter((_, i) => offer[i] > 0));
      chosenRow = column.findIndex((c, i) => c === minCost && offer[i] > 0);
    }

    const quantity = Math.min(offer[chosenRow], demand[chosenCol]);
    allocations[chosenRow][chosenCol] = quantity;

    offer[chosenRow] -= quantity;
    demand[chosenCol] -= quantity;

    steps.push({
      allocations: clone2D(allocations),
      offer: [...offer],
      demand: [...demand],
      chosen: [chosenRow, chosenCol],
      penalties: { rowPen, colPen },
      note: `Allocation de ${quantity}`,
    });
  }

  /* Gestion dégénérescence */
  const needed = m + n - 1;
  let currentAllocs = allocations.flat().filter((x) => x !== null).length;
  while (currentAllocs < needed) {
    // trouver la coût minimal restant
    let best = { i: -1, j: -1, cost: Infinity };
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (allocations[i][j] === null && costs[i][j] < best.cost) {
          best = { i, j, cost: costs[i][j] };
        }
      }
    }
    allocations[best.i][best.j] = 0; // epsilon
    currentAllocs++;
  }

  steps.push({
    allocations: clone2D(allocations),
    offer: [...offer],
    demand: [...demand],
    chosen: null,
    penalties: null,
    note: "Fin de l'algorithme — solution de base obtenue",
  });

  return steps;
}

function computeZ(costs, alloc) {
  let z = 0;
  for (let i = 0; i < costs.length; i++) {
    for (let j = 0; j < costs[0].length; j++) {
      if (alloc[i][j] != null) z += costs[i][j] * alloc[i][j];
    }
  }
  return z;
}

/******************************
 * UI component
 *****************************/

const defaultRows = 4;
const defaultCols = 6;

export default function BalasHammerApp() {
  const [rows, setRows] = useState(defaultRows);
  const [cols, setCols] = useState(defaultCols);
  const [costs, setCosts] = useState(
    Array.from({ length: defaultRows }, () => Array(defaultCols).fill(0))
  );
  const [offer, setOffer] = useState(Array(defaultRows).fill(0));
  const [demand, setDemand] = useState(Array(defaultCols).fill(0));

  const [steps, setSteps] = useState([]);
  //const [stepIdx, setStepIdx] = useState(0);

  //    const current = steps[stepIdx] ?? null;

  /** Handlers **/
  const handleCostChange = (i, j, v) => {
    const cpy = clone2D(costs);
    cpy[i][j] = Number(v);
    setCosts(cpy);
  };

  const handleRun = () => {
    const s = balasHammer(costs, offer, demand);
    setSteps(s);
    //setStepIdx(s.length - 1); // aller à la solution finale directement
  };

  const exportPDF = async () => {
    const element = document.getElementById("result-table");
    if (!element) return;
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape" });
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("balas_hammer_solution.pdf");
  };

  /********************** RENDU **********************/
  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold text-red-700 text-center mb-2">
        ALGORITHME ‑ Ballas HAMMER
      </h1>
      <div className="bg-blue-700 text-white font-semibold py-2 px-4 text-center mb-4">
        Méthode de différence maximale (Algorithme de Balas‑Hammer)
      </div>

      {/* Paramètres */}
      <div className="grid grid-cols-2 gap-4 mb-8 max-w-4xl mx-auto">
        <label className="col-span-1 flex flex-col">
          Lignes (sources)
          <input
            type="number"
            value={rows}
            onChange={(e) => {
              const r = Number(e.target.value);
              setRows(r);
              setCosts(Array.from({ length: r }, () => Array(cols).fill(0)));
              setOffer(Array(r).fill(0));
            }}
            className="border rounded p-1"
          />
        </label>
        <label className="col-span-1 flex flex-col">
          Colonnes (destinations)
          <input
            type="number"
            value={cols}
            onChange={(e) => {
              const c = Number(e.target.value);
              setCols(c);
              setCosts((prev) =>
                prev.map((row) => [...row, ...Array(c - row.length).fill(0)])
              );
              setDemand(Array(c).fill(0));
            }}
            className="border rounded p-1"
          />
        </label>
      </div>

      {/* Saisie matrice */}
      <div className="overflow-auto mb-6">
        <table className="mx-auto border border-black">
          <thead>
            <tr>
              <th className="border border-black"></th>
              {[...Array(cols)].map((_, j) => (
                <th key={j} className="border border-black px-2">
                  {j + 1}
                </th>
              ))}
              <th className="border border-black px-2">Offre</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, i) => (
              <tr key={i}>
                <td className="border border-black px-2 font-semibold">
                  {String.fromCharCode(65 + i)}
                </td>
                {[...Array(cols)].map((__, j) => (
                  <td key={j} className="border border-black">
                    <input
                      type="number"
                      value={costs[i][j]}
                      onChange={(e) => handleCostChange(i, j, e.target.value)}
                      className="w-16 p-1 text-center"
                    />
                  </td>
                ))}
                <td className="border border-black">
                  <input
                    type="number"
                    value={offer[i]}
                    onChange={(e) => {
                      const arr = [...offer];
                      arr[i] = Number(e.target.value);
                      setOffer(arr);
                    }}
                    className="w-20 p-1 text-center text-red-600 font-bold"
                  />
                </td>
              </tr>
            ))}
            <tr>
              <td className="border border-black font-semibold">Demande</td>
              {[...Array(cols)].map((_, j) => (
                <td key={j} className="border border-black">
                  <input
                    type="number"
                    value={demand[j]}
                    onChange={(e) => {
                      const arr = [...demand];
                      arr[j] = Number(e.target.value);
                      setDemand(arr);
                    }}
                    className="w-16 p-1 text-center text-red-600 font-bold"
                  />
                </td>
              ))}
              <td className="border border-black"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={handleRun}
          className="bg-green-600 text-white px-4 py-2 rounded shadow"
        >
          Résoudre
        </button>
        {steps.length > 0 && (
          <>
            {/* <button
              onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
              className="bg-gray-400 text-white px-4 py-2 rounded"
            >
              ← Étape précédente
            </button>
            <button
              onClick={() => setStepIdx((s) => Math.min(steps.length - 1, s + 1))}
              className="bg-gray-400 text-white px-4 py-2 rounded"
            >
              Étape suivante →
            </button> */}
            <button
              onClick={exportPDF}
              className="bg-blue-700 text-white px-4 py-2 rounded shadow"
            >
              Exporter en PDF
            </button>
          </>
        )}
      </div>

      {/* Résultat */}
   {/* Résultat final avec graphe + étapes */}
{steps.length > 0 && (
  <div className="flex flex-col md:flex-row justify-center items-start gap-8 mb-12">
    
    {/* 🎯 Graphe des allocations finales */}
    <svg
      width="400"
      height={Math.max(rows, cols) * 80}
      className="bg-white border border-black shadow"
    >
      {/* Nœuds sources */}
      {Array.from({ length: rows }).map((_, i) => (
        <g key={i}>
          <circle cx={60} cy={i * 80 + 40} r={20} fill="#f0f0f0" stroke="#333" />
          <text x={60} y={i * 80 + 45} textAnchor="middle" fontWeight="bold">
            {String.fromCharCode(65 + i)}
          </text>
        </g>
      ))}

      {/* Nœuds destinations */}
      {Array.from({ length: cols }).map((_, j) => (
        <g key={j}>
          <circle cx={340} cy={j * 80 + 40} r={20} fill="#f0f0f0" stroke="#333" />
          <text x={340} y={j * 80 + 45} textAnchor="middle" fontWeight="bold">
            {j + 1}
          </text>
        </g>
      ))}

      {/* Liaisons avec allocations */}
      {steps[steps.length - 1].allocations.map((row, i) =>
        row.map((alloc, j) => {
          if (alloc != null && alloc !== 0) {
            return (
              <g key={`${i}-${j}`}>
                <line
                  x1={80}
                  y1={i * 80 + 40}
                  x2={320}
                  y2={j * 80 + 40}
                  stroke="#888"
                  strokeWidth="2"
                />
                <text
                  x={(80 + 320) / 2}
                  y={(i * 80 + 40 + j * 80 + 40) / 2 - 5}
                  fill="red"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {alloc}
                </text>
              </g>
            );
          }
          return null;
        })
      )}
    </svg>

    {/* ✅ Tableaux des étapes */}
    <div id="result-table" className="space-y-12 flex-1">
      {steps.map((step, index) => {
        const maxRowPen = step.penalties ? Math.max(...step.penalties.rowPen) : -1;
        const maxColPen = step.penalties ? Math.max(...step.penalties.colPen) : -1;

        return (
          <div key={index} className="overflow-auto border border-black p-4 bg-white shadow rounded">
            <h2 className="text-center font-bold text-xl mb-2">Étape {index + 1}</h2>

            {/* Tableau des pénalités */}
            {step.penalties && (
              <table className="mx-auto mb-4 border border-black">
                <thead>
                  <tr>
                    <th className="border border-black px-2">Ligne</th>
                    {step.penalties.rowPen.map((_, i) => (
                      <th key={i} className={`border border-black px-2 ${step.penalties.rowPen[i] === maxRowPen ? "bg-red-200" : ""}`}>
                        {String.fromCharCode(65 + i)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black font-semibold">Pénalité</td>
                    {step.penalties.rowPen.map((p, i) => (
                      <td key={i} className={`border border-black text-center text-blue-600 font-bold ${p === maxRowPen ? "bg-red-100" : ""}`}>
                        {p}
                      </td>
                    ))}
                  </tr>
                </tbody>
                <thead>
                  <tr>
                    <th className="border border-black px-2">Colonne</th>
                    {step.penalties.colPen.map((_, j) => (
                      <th key={j} className={`border border-black px-2 ${step.penalties.colPen[j] === maxColPen ? "bg-red-200" : ""}`}>
                        {j + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black font-semibold">Pénalité</td>
                    {step.penalties.colPen.map((p, j) => (
                      <td key={j} className={`border border-black text-center text-blue-600 font-bold ${p === maxColPen ? "bg-red-100" : ""}`}>
                        {p}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            )}

            {/* Tableau principal */}
            <table className="mx-auto border border-black">
              <thead>
                <tr>
                  <th className="border border-black"></th>
                  {[...Array(cols)].map((_, j) => (
                    <th key={j} className="border border-black px-2">
                      {j + 1}
                    </th>
                  ))}
                  <th className="border border-black font-semibold text-blue-700">Pénalité ligne</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(rows)].map((_, i) => {
                  const isRowMaxPen = step.penalties && step.penalties.rowPen[i] === maxRowPen;
                  const rowIsDone = step.offer[i] === 0;

                  return (
                    <tr key={i} className={rowIsDone ? "bg-gray-200" : ""}>
                      <td className={`border border-black px-2 font-semibold ${isRowMaxPen ? "bg-red-200" : ""}`}>
                        {String.fromCharCode(65 + i)}
                      </td>
                      {[...Array(cols)].map((__, j) => {
                        const isColMaxPen = step.penalties && step.penalties.colPen[j] === maxColPen;
                        const colIsDone = step.demand[j] === 0;
                        const isChosen = step.chosen && step.chosen[0] === i && step.chosen[1] === j;
                        const alloc = step.allocations[i][j];

                        return (
                          <td
                            key={j}
                            className={`border border-black w-20 h-12 relative text-center ${
                              isChosen ? "bg-yellow-200" : ""
                            } ${colIsDone ? "bg-gray-200" : ""} ${
                              isColMaxPen ? "bg-red-200" : ""
                            }`}
                          >
                            <div>{costs[i][j]}</div>
                            {alloc != null && (
                              <div className="absolute bottom-0 right-0 text-red-600 font-bold text-sm">
                                {alloc}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="border border-black text-blue-600 font-bold text-center">
                        {step.penalties ? step.penalties.rowPen[i] : ""}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="border border-black font-semibold text-blue-700">Pénalité colonne</td>
                  {[...Array(cols)].map((_, j) => {
                    const colIsDone = step.demand[j] === 0;
                    return (
                      <td
                        key={j}
                        className={`border border-black text-blue-600 font-bold text-center ${
                          colIsDone ? "line-through" : ""
                        }`}
                      >
                        {step.penalties ? step.penalties.colPen[j] : ""}
                      </td>
                    );
                  })}
                  <td className="border border-black"></td>
                </tr>
              </tbody>
            </table>

            {/* Z à la fin */}
            {index === steps.length - 1 && (
              <div className="mt-4 text-center text-lg font-bold">
                Z = {computeZ(costs, step.allocations)}
              </div>
            )}
            <p className="mt-2 text-center italic">{step.note}</p>
          </div>
        );
      })}
    </div>
  </div>
)}

</div>
  );
}
