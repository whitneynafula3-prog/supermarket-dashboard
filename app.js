let population = [];
let transactionRecords = [];
let distChart = null;
let compareChart = null;
let itemAmountChart = null;
let samplingDistChart = null;

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function variance(arr, ddof = 0) {
  if (arr.length <= ddof) return 0;
  const m = mean(arr);
  const sqDiffs = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0);
  return sqDiffs / (arr.length - ddof);
}

function stdDev(arr, ddof = 0) {
  return Math.sqrt(variance(arr, ddof));
}

function formatKES(num) {
  return (
    "KES " +
    Number(num).toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatNumber(num) {
  return Number(num).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Simple Random Sample Without Replacement (Fisher-Yates shuffle)
function drawSampleWithoutReplacement(arr, n) {
  const copy = [...arr];
  const size = Math.min(n, copy.length);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, size);
}

function buildHistogramBins(values, binCount = 10) {
  if (!values.length) {
    return { labels: [], counts: [], minVal: 0, step: 1, binCount: 0 };
  }
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal || 1;
  const step = span / binCount;

  const counts = new Array(binCount).fill(0);
  const labels = [];

  for (let i = 0; i < binCount; i++) {
    const start = minVal + i * step;
    const end = i === binCount - 1 ? maxVal : minVal + (i + 1) * step;
    labels.push(`${Math.round(start)}–${Math.round(end)}`);
  }

  for (const v of values) {
    let idx = Math.floor((v - minVal) / step);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }

  return { labels, counts, minVal, step, binCount };
}

function mapSampleToBins(sample, binMeta) {
  const { minVal, step, binCount } = binMeta;
  const counts = new Array(binCount).fill(0);

  for (const v of sample) {
    let idx = Math.floor((v - minVal) / step);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  return counts;
}

function normalizeRecords(data, amounts) {
  const candidateArrays = [
    data.transactions,
    data.records,
    data.items,
    data.data,
  ].filter(Array.isArray);

  for (const arr of candidateArrays) {
    if (arr.length > 0 && typeof arr[0] === "object" && arr[0] !== null) {
      const parsed = arr
        .map((row, idx) => {
          const itemName =
            row.item ??
            row.product ??
            row.item_name ??
            row.product_name ??
            row.category ??
            null;
          const rawAmount =
            row.amount ??
            row.amount_kes ??
            row.spend ??
            row.total ??
            row.price ??
            amounts[idx];
          const numAmount = Number(rawAmount);
          if (!Number.isFinite(numAmount)) return null;
          return {
            item: itemName ? String(itemName).trim() : "Unspecified Item",
            amount: numAmount,
          };
        })
        .filter(Boolean);

      if (parsed.length > 0) return parsed;
    }
  }

  return amounts.map((amt) => ({
    item: null,
    amount: Number(amt),
  }));
}

function populateItemDropdown() {
  const select = document.getElementById("itemFilter");
  if (!select) return;

  const uniqueItems = Array.from(
    new Set(transactionRecords.map((r) => r.item).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "ALL";
  allOption.textContent = uniqueItems.length
    ? "All Items"
    : "All Transactions (No Item Field)";
  select.appendChild(allOption);

  for (const itemName of uniqueItems) {
    const opt = document.createElement("option");
    opt.value = itemName;
    opt.textContent = itemName;
    select.appendChild(opt);
  }
}

function renderItemAmountGraph(filteredRecords, selectedItem, amountInputVal) {
  const canvas = document.getElementById("itemAmountChart");
  const titleEl = document.getElementById("itemAmountChartTitle");
  const subtitleEl = document.getElementById("itemAmountChartSubtitle");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (itemAmountChart) {
    itemAmountChart.destroy();
  }

  const hasAmountFilter =
    amountInputVal !== "" && !Number.isNaN(Number(amountInputVal));
  const targetAmount = hasAmountFilter ? Number(amountInputVal) : null;

  const itemDesc =
    selectedItem && selectedItem !== "ALL"
      ? `Item: "${selectedItem}"`
      : "All Items";
  const amtDesc = hasAmountFilter
    ? `Amount Paid: ${formatKES(targetAmount)}`
    : "Any Amount Paid";

  if (titleEl) {
    titleEl.textContent = `${itemDesc} • ${amtDesc}`;
  }

  if (!filteredRecords.length) {
    if (subtitleEl) {
      subtitleEl.textContent =
        "No matching transactions found for this item/amount combination.";
    }
    itemAmountChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["No Matches"],
        datasets: [
          {
            label: "Matching Transactions",
            data: [0],
            backgroundColor: "rgba(148, 163, 184, 0.5)",
            borderColor: "rgba(100, 116, 139, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
      },
    });
    return;
  }

  const amounts = filteredRecords.map((r) => r.amount);
  const hasNamedItems = filteredRecords.some((r) => r.item);

  if (selectedItem === "ALL" && !hasAmountFilter && hasNamedItems) {
    const totalsByItem = new Map();
    for (const rec of filteredRecords) {
      const key = rec.item || "Unspecified Item";
      totalsByItem.set(key, (totalsByItem.get(key) || 0) + rec.amount);
    }

    const sorted = Array.from(totalsByItem.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    if (subtitleEl) {
      subtitleEl.textContent = `Showing total spend (KES) for the top ${sorted.length} items across ${filteredRecords.length} matching transactions`;
    }

    itemAmountChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: sorted.map(([name]) => name),
        datasets: [
          {
            label: "Total Spend (KES)",
            data: sorted.map(([, total]) => total),
            backgroundColor: "rgba(20, 83, 45, 0.75)",
            borderColor: "rgba(20, 83, 45, 1)",
            borderWidth: 1,
            borderRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Total Spend (KES)" },
          },
          x: {
            title: { display: true, text: "Item" },
          },
        },
      },
    });
    return;
  }

  const binCount = Math.min(8, Math.max(1, new Set(amounts).size));
  const bins = buildHistogramBins(amounts, binCount);

  if (subtitleEl) {
    subtitleEl.textContent = `Distribution of ${filteredRecords.length} matching transaction(s) by amount paid (KES)`;
  }

  itemAmountChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: bins.labels,
      datasets: [
        {
          label: "Matching Transactions",
          data: bins.counts,
          backgroundColor: "rgba(14, 165, 233, 0.7)",
          borderColor: "rgba(14, 165, 233, 1)",
          borderWidth: 1,
          borderRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: "Number of Transactions" },
        },
        x: {
          title: { display: true, text: "Amount Paid (KES)" },
        },
      },
    },
  });
}

function updateItemAmountFilter() {
  const itemSelect = document.getElementById("itemFilter");
  const amountInput = document.getElementById("amountFilter");

  const selectedItem = itemSelect ? itemSelect.value : "ALL";
  const rawAmount = amountInput ? amountInput.value.trim() : "";
  const hasAmount = rawAmount !== "" && !Number.isNaN(Number(rawAmount));
  const targetAmount = hasAmount ? Number(rawAmount) : null;

  const filtered = transactionRecords.filter((rec) => {
    const itemMatches = selectedItem === "ALL" || rec.item === selectedItem;
    const amountMatches =
      !hasAmount || Math.abs(rec.amount - targetAmount) < 1e-6;
    return itemMatches && amountMatches;
  });

  const matchCount = filtered.length;
  const matchTotal = filtered.reduce((sum, r) => sum + r.amount, 0);
  const matchAvg = matchCount ? matchTotal / matchCount : 0;

  document.getElementById("matchCount").textContent = matchCount.toLocaleString();
  document.getElementById("matchTotal").textContent = formatKES(matchTotal);
  document.getElementById("matchAvg").textContent = matchCount
    ? formatKES(matchAvg)
    : "KES --";

  renderItemAmountGraph(filtered, selectedItem, rawAmount);
}

function resetItemAmountFilter() {
  const itemSelect = document.getElementById("itemFilter");
  const amountInput = document.getElementById("amountFilter");
  if (itemSelect) itemSelect.value = "ALL";
  if (amountInput) amountInput.value = "";
  updateItemAmountFilter();
}

function runRepeatedSampling(numSimulations = 500) {
  if (!Array.isArray(population) || population.length === 0) return;

  const n = Number(document.getElementById("sampleSize").value);
  const popStd = stdDev(population, 0);
  const theoreticalSE = popStd / Math.sqrt(n);

  const sampleMeans = [];
  for (let i = 0; i < numSimulations; i++) {
    const sample = drawSampleWithoutReplacement(population, n);
    sampleMeans.push(mean(sample));
  }

  const grandMean = mean(sampleMeans);
  const empiricalSE = stdDev(sampleMeans, 1);

  document.getElementById("simCount").textContent =
    sampleMeans.length.toLocaleString();
  document.getElementById("simGrandMean").textContent = formatKES(grandMean);
  document.getElementById("simEmpiricalSE").textContent = formatKES(empiricalSE);
  document.getElementById("simTheoreticalSE").textContent =
    formatKES(theoreticalSE);

  const bins = buildHistogramBins(sampleMeans, 12);
  const canvas = document.getElementById("samplingDistChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (samplingDistChart) samplingDistChart.destroy();

  document.getElementById("samplingDistTitle").textContent =
    `Sampling Distribution of X̄ (${numSimulations} Samples, n = ${n})`;
  document.getElementById("samplingDistSubtitle").textContent =
    `Empirical SE: ${formatKES(empiricalSE)} vs. Theoretical σ/√n: ${formatKES(theoreticalSE)}`;

  samplingDistChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: bins.labels,
      datasets: [
        {
          label: "Frequency of Sample Means (X̄)",
          data: bins.counts,
          backgroundColor: "rgba(20, 83, 45, 0.65)",
          borderColor: "rgba(20, 83, 45, 1)",
          borderWidth: 1,
          borderRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: "Number of Samples" },
        },
        x: {
          title: { display: true, text: "Sample Mean Spend (KES)" },
        },
      },
    },
  });
}

function renderPopulationKPIs() {
  const popMean = mean(population);
  const popVar = variance(population, 0);
  const popStd = stdDev(population, 0);
  const popTotal = population.reduce((a, b) => a + b, 0);

  document.getElementById("popCount").textContent =
    population.length.toLocaleString();
  document.getElementById("popMean").textContent = formatKES(popMean);
  document.getElementById("popStd").textContent = formatKES(popStd);
  document.getElementById("popVar").textContent = formatNumber(popVar);
  document.getElementById("popTotal").textContent = formatKES(popTotal);
}

function updateSimulation() {
  const n = Number(document.getElementById("sampleSize").value);
  document.getElementById("sampleSizeLabel").textContent = n;

  const sample = drawSampleWithoutReplacement(population, n);
  const popMean = mean(population);
  const sMean = mean(sample);
  const sVar = variance(sample, 1); // unbiased sample variance (n - 1)
  const error = Math.abs(sMean - popMean);
  const errorPct = ((error / popMean) * 100).toFixed(2);

  document.getElementById("sampleMean").textContent = formatKES(sMean);
  document.getElementById("sampleVar").textContent = formatNumber(sVar);
  document.getElementById("estError").textContent = formatKES(error);
  document.getElementById("errorPct").textContent =
    `${errorPct}% away from true mean`;

  updateCharts(sample, n, popMean, sMean);
}

function updateCharts(sample, n, popMean, sMean) {
  const binMeta = buildHistogramBins(population, 10);
  const sampleCounts = mapSampleToBins(sample, binMeta);

  const distCtx = document.getElementById("distChart").getContext("2d");
  if (distChart) distChart.destroy();

  distChart = new Chart(distCtx, {
    type: "bar",
    data: {
      labels: binMeta.labels,
      datasets: [
        {
          label: `Population (N = ${population.length.toLocaleString()})`,
          data: binMeta.counts,
          backgroundColor: "rgba(20, 83, 45, 0.25)",
          borderColor: "rgba(20, 83, 45, 0.85)",
          borderWidth: 1,
        },
        {
          label: `Active Sample (n = ${n})`,
          data: sampleCounts,
          backgroundColor: "rgba(14, 165, 233, 0.65)",
          borderColor: "rgba(14, 165, 233, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Number of Transactions" },
        },
        x: {
          title: { display: true, text: "Transaction Amount (KES)" },
        },
      },
    },
  });

  const mean20 = mean(drawSampleWithoutReplacement(population, 20));
  const mean50 = mean(drawSampleWithoutReplacement(population, 50));
  const mean100 = mean(drawSampleWithoutReplacement(population, 100));

  const compCtx = document.getElementById("compareChart").getContext("2d");
  if (compareChart) compareChart.destroy();

  compareChart = new Chart(compCtx, {
    type: "bar",
    data: {
      labels: [
        "n = 20",
        "n = 50",
        "n = 100",
        `Selected (n = ${n})`,
        "True Mean (μ)",
      ],
      datasets: [
        {
          label: "Mean Spend (KES)",
          data: [mean20, mean50, mean100, sMean, popMean],
          backgroundColor: [
            "#93c5fd",
            "#60a5fa",
            "#3b82f6",
            "#0ea5e9",
            "#14532d",
          ],
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: false,
          title: { display: true, text: "Mean Spend (KES)" },
        },
      },
    },
  });
}

async function initDashboard() {
  try {
    const response = await fetch("dashboard_data.json");
    if (!response.ok) {
      throw new Error("Could not load dashboard_data.json");
    }
    const data = await response.json();
    population = data.transaction_amounts_kes;

    if (!Array.isArray(population) || population.length === 0) {
      throw new Error("transaction_amounts_kes is empty");
    }

    transactionRecords = normalizeRecords(data, population);
    populateItemDropdown();

    renderPopulationKPIs();
    updateSimulation();
    updateItemAmountFilter();
  } catch (err) {
    console.error(err);
    document.getElementById("popMean").textContent = "Run export first";
    alert(
      "Could not find dashboard_data.json in this folder yet. Export it from your Python notebook into the same folder as index.html, then refresh the page."
    );
  }
}

document.getElementById("sampleSize").addEventListener("input", updateSimulation);
document.getElementById("redrawBtn").addEventListener("click", updateSimulation);

document.querySelectorAll(".preset").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById("sampleSize").value = btn.dataset.n;
    updateSimulation();
  });
});

document
  .getElementById("itemFilter")
  .addEventListener("change", updateItemAmountFilter);
document
  .getElementById("amountFilter")
  .addEventListener("input", updateItemAmountFilter);
document
  .getElementById("clearFilterBtn")
  .addEventListener("click", resetItemAmountFilter);
document
  .getElementById("run500Btn")
  .addEventListener("click", () => runRepeatedSampling(500));

initDashboard();
